import db from "../db/index.js";
import dotenv from "dotenv";

dotenv.config();

const DEFAULT_RSSI_THRESHOLD = parseInt(process.env.DEFAULT_RSSI_THRESHOLD || "-85", 10);

/**
 * Get current RSSI threshold: GET /api/config/rssi-threshold
 */
export async function getRssiThreshold(req, res) {
  try {
    const result = await db.query(
      "SELECT config_value FROM app_config WHERE config_key = 'rssi_threshold'"
    );

    const rssiThreshold = result.rows.length > 0 
      ? parseInt(result.rows[0].config_value, 10) 
      : DEFAULT_RSSI_THRESHOLD;

    return res.json({ rssiThreshold });
  } catch (err) {
    console.error("Get RSSI threshold error:", err);
    return res.status(500).json({ error: "Internal server error retrieving configuration" });
  }
}

/**
 * Update RSSI threshold: PUT /api/config/rssi-threshold
 */
export async function updateRssiThreshold(req, res) {
  const { rssiThreshold } = req.body;

  if (rssiThreshold === undefined) {
    return res.status(400).json({ error: "Missing required field: rssiThreshold" });
  }

  const numericRssi = parseInt(rssiThreshold, 10);
  if (isNaN(numericRssi) || numericRssi < -100 || numericRssi > -30) {
    return res.status(400).json({ error: "RSSI threshold must be an integer between -100 and -30" });
  }

  try {
    // Insert or update threshold value in database config table
    await db.query(
      `INSERT INTO app_config (config_key, config_value) 
       VALUES ('rssi_threshold', $1)
       ON CONFLICT (config_key) 
       DO UPDATE SET config_value = EXCLUDED.config_value`,
      [numericRssi.toString()]
    );

    return res.json({
      message: "RSSI threshold updated successfully",
      rssiThreshold: numericRssi
    });
  } catch (err) {
    console.error("Update RSSI threshold error:", err);
    return res.status(500).json({ error: "Internal server error updating configuration" });
  }
}
