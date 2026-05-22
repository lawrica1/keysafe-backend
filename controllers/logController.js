import db from "../db/index.js";

/**
 * Get tracking logs: GET /api/tracking-logs
 * Filters: keyId, userId, startDate, endDate
 * Pagination: limit (default 20), offset (default 0)
 */
export async function getLogs(req, res) {
  const { keyId, userId, startDate, endDate, limit, offset } = req.query;

  // Access Control: Non-admins MUST specify keyId
  const isAdmin = req.user.role === "admin";
  if (!isAdmin && !keyId) {
    return res.status(403).json({ 
      error: "Forbidden: Non-admin users must specify 'keyId' query parameter to retrieve logs" 
    });
  }

  try {
    let queryText = `
      SELECT tl.log_id, tl.key_id, k.name AS key_name, tl.reported_by, 
             tl.gateway_id, tl.rssi, tl.lat, tl.lng, tl.timestamp
      FROM tracking_logs tl
      LEFT JOIN keys k ON tl.key_id = k.key_id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramCounter = 1;

    // Apply keyId filter
    if (keyId) {
      queryText += ` AND tl.key_id = $${paramCounter}`;
      queryParams.push(keyId);
      paramCounter++;
    }

    // Apply userId filter (logs matched by gateway_id = 'phone_' + userId)
    if (userId) {
      queryText += ` AND tl.gateway_id = $${paramCounter}`;
      queryParams.push(`phone_${userId}`);
      paramCounter++;
    }

    // Apply startDate filter
    if (startDate) {
      queryText += ` AND tl.timestamp >= $${paramCounter}`;
      queryParams.push(startDate);
      paramCounter++;
    }

    // Apply endDate filter
    if (endDate) {
      queryText += ` AND tl.timestamp <= $${paramCounter}`;
      queryParams.push(endDate);
      paramCounter++;
    }

    // Count total rows matching criteria for pagination metadata
    let countQueryText = queryText.replace(
      `SELECT tl.log_id, tl.key_id, k.name AS key_name, tl.reported_by, \n             tl.gateway_id, tl.rssi, tl.lat, tl.lng, tl.timestamp`,
      "SELECT COUNT(*) as total"
    );
    const countResult = await db.query(countQueryText, queryParams);
    const totalCount = parseInt(countResult.rows[0].total, 10);

    // Apply Ordering
    queryText += ` ORDER BY tl.timestamp DESC`;

    // Apply Limit pagination
    const parsedLimit = parseInt(limit, 10) || 20;
    queryText += ` LIMIT $${paramCounter}`;
    queryParams.push(parsedLimit);
    paramCounter++;

    // Apply Offset pagination
    const parsedOffset = parseInt(offset, 10) || 0;
    queryText += ` OFFSET $${paramCounter}`;
    queryParams.push(parsedOffset);
    paramCounter++;

    // Execute query
    const result = await db.query(queryText, queryParams);

    // Format logs output standardizing properties
    const formattedLogs = result.rows.map(row => ({
      id: row.log_id,
      keyId: row.key_id,
      keyName: row.key_name || "Deleted Key",
      reportedBy: row.reported_by,
      gatewayId: row.gateway_id,
      rssi: row.rssi,
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lng),
      timestamp: row.timestamp
    }));

    return res.json({
      logs: formattedLogs,
      pagination: {
        total: totalCount,
        limit: parsedLimit,
        offset: parsedOffset
      }
    });

  } catch (err) {
    console.error("Get logs error:", err);
    return res.status(500).json({ error: "Internal server error retrieving logs" });
  }
}
