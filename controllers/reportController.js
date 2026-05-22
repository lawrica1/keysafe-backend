import db from "../db/index.js";
import dotenv from "dotenv";

dotenv.config();

const DEFAULT_RSSI_THRESHOLD = parseInt(process.env.DEFAULT_RSSI_THRESHOLD || "-85", 10);

/**
 * Ingest scan reports from phone: POST /api/reports
 */
export async function createReport(req, res) {
  const { keyId, lat, lng, rssi } = req.body;

  // 1. Inputs validation
  if (keyId === undefined || lat === undefined || lng === undefined || rssi === undefined) {
    return res.status(400).json({ error: "Missing required fields: keyId, lat, lng, rssi" });
  }

  const numericLat = parseFloat(lat);
  const numericLng = parseFloat(lng);
  const numericRssi = parseInt(rssi, 10);

  if (isNaN(numericLat) || isNaN(numericLng)) {
    return res.status(400).json({ error: "Latitude and longitude must be valid numbers" });
  }

  if (isNaN(numericRssi) || numericRssi < -100 || numericRssi > -30) {
    return res.status(400).json({ error: "RSSI must be an integer between -100 and -30" });
  }

  try {
    // 2. Validate key existence
    const keyResult = await db.query("SELECT * FROM keys WHERE key_id = $1", [keyId]);
    if (keyResult.rows.length === 0) {
      return res.status(404).json({ error: `Key with ID '${keyId}' not registered in system` });
    }

    const key = keyResult.rows[0];

    // 3. Fetch current RSSI threshold from app_config
    const configResult = await db.query("SELECT config_value FROM app_config WHERE config_key = 'rssi_threshold'");
    const threshold = configResult.rows.length > 0 
      ? parseInt(configResult.rows[0].config_value, 10) 
      : DEFAULT_RSSI_THRESHOLD;

    // 4. RSSI Filter Check (If weaker than threshold, ignore database writes but return 200 OK)
    if (numericRssi < threshold) {
      return res.status(200).json({ 
        status: "ignored", 
        message: `Report filtered: RSSI ${numericRssi} dBm is below threshold of ${threshold} dBm` 
      });
    }

    // 5. Processing valid report
    // Check if key is marked as 'lost' and RSSI is strong (>= -60) -> Auto-set to 'available'
    let newStatus = key.status;
    let statusUpdateNote = "";
    if (key.status === "lost" && numericRssi >= -60) {
      newStatus = "available";
      statusUpdateNote = " (Key recovered from lost status due to strong signal)";
    }

    // Update keys location
    await db.query(
      `UPDATE keys 
       SET latitude = $1, longitude = $2, status = $3, last_updated = CURRENT_TIMESTAMP 
       WHERE key_id = $4`,
      [numericLat, numericLng, newStatus, keyId]
    );

    // Insert tracking logs audit trail
    const gatewayId = `phone_${req.user.userId}`;
    await db.query(
      `INSERT INTO tracking_logs (key_id, reported_by, gateway_id, rssi, lat, lng, timestamp) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [keyId, req.user.fullName, gatewayId, numericRssi, numericLat, numericLng]
    );

    return res.status(200).json({
      status: "success",
      message: `Report logged successfully${statusUpdateNote}`,
      keyStatus: newStatus
    });

  } catch (err) {
    console.error("Report ingestion error:", err);
    return res.status(500).json({ error: "Internal server error processing scan report" });
  }
}
