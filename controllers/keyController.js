import db from "../db/index.js";

/**
 * List all keys: GET /api/keys
 * Includes current holder's full name.
 */
export async function getKeys(req, res) {
  try {
    const queryText = `
      SELECT k.key_id, k.name, k.category, k.status, k.current_holder_id, 
             u.full_name AS holder_name, k.latitude, k.longitude, k.last_updated
      FROM keys k
      LEFT JOIN users u ON k.current_holder_id = u.user_id
      ORDER BY k.name ASC
    `;
    const result = await db.query(queryText);
    
    // Map db columns to fit standard camelCase response payload
    const formattedKeys = result.rows.map(row => ({
      id: row.key_id,
      name: row.name,
      category: row.category,
      status: row.status,
      currentHolderId: row.current_holder_id,
      holderName: row.holder_name || "Unassigned",
      lat: row.latitude !== null ? parseFloat(row.latitude) : null,
      lng: row.longitude !== null ? parseFloat(row.longitude) : null,
      lastUpdated: row.last_updated
    }));

    return res.json(formattedKeys);
  } catch (err) {
    console.error("List keys error:", err);
    return res.status(500).json({ error: "Internal server error retrieving keys list" });
  }
}

/**
 * Get single key details: GET /api/keys/:keyId
 */
export async function getKeyById(req, res) {
  const { keyId } = req.params;

  try {
    const queryText = `
      SELECT k.key_id, k.name, k.category, k.status, k.current_holder_id, 
             u.full_name AS holder_name, k.latitude, k.longitude, k.last_updated
      FROM keys k
      LEFT JOIN users u ON k.current_holder_id = u.user_id
      WHERE k.key_id = $1
    `;
    const result = await db.query(queryText, [keyId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Key with ID '${keyId}' not found` });
    }

    const row = result.rows[0];
    const keyData = {
      id: row.key_id,
      name: row.name,
      category: row.category,
      status: row.status,
      currentHolderId: row.current_holder_id,
      holderName: row.holder_name || "Unassigned",
      lat: row.latitude !== null ? parseFloat(row.latitude) : null,
      lng: row.longitude !== null ? parseFloat(row.longitude) : null,
      lastUpdated: row.last_updated
    };

    return res.json(keyData);
  } catch (err) {
    console.error("Get key error:", err);
    return res.status(500).json({ error: "Internal server error retrieving key details" });
  }
}

/**
 * Create key: POST /api/keys (Admin only)
 */
export async function createKey(req, res) {
  const { keyId, keyName, category, currentHolderId, status } = req.body;

  if (!keyId || !keyName || !category) {
    return res.status(400).json({ error: "Missing required fields: keyId (BLE UUID), keyName, category" });
  }

  // Validate category
  if (!["Office", "Vehicle", "Residential"].includes(category)) {
    return res.status(400).json({ error: "Category must be either Office, Vehicle, or Residential" });
  }

  // Validate status if provided
  const targetStatus = status || "available";
  if (!["available", "checked_out", "lost"].includes(targetStatus)) {
    return res.status(400).json({ error: "Status must be either available, checked_out, or lost" });
  }

  try {
    // Check duplication
    const duplicateCheck = await db.query("SELECT key_id FROM keys WHERE key_id = $1", [keyId]);
    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ error: `Key with ID '${keyId}' already exists` });
    }

    // Validate holder user exists if provided
    let holderId = null;
    if (currentHolderId) {
      const userCheck = await db.query("SELECT user_id FROM users WHERE user_id = $1", [currentHolderId]);
      if (userCheck.rows.length === 0) {
        return res.status(400).json({ error: `Current holder user ID '${currentHolderId}' does not exist` });
      }
      holderId = currentHolderId;
    }

    await db.query(
      `INSERT INTO keys (key_id, name, category, status, current_holder_id, latitude, longitude, last_updated)
       VALUES ($1, $2, $3, $4, $5, NULL, NULL, CURRENT_TIMESTAMP)`,
      [keyId, keyName, category, targetStatus, holderId]
    );

    return res.status(201).json({
      message: "Key registered successfully",
      key: {
        id: keyId,
        name: keyName,
        category,
        status: targetStatus,
        currentHolderId: holderId,
        lat: null,
        lng: null
      }
    });
  } catch (err) {
    console.error("Create key error:", err);
    return res.status(500).json({ error: "Internal server error creating key" });
  }
}

/**
 * Update key: PUT /api/keys/:keyId (Admin only)
 */
export async function updateKey(req, res) {
  const { keyId } = req.params;
  const { name, category, status, currentHolderId, lat, lng } = req.body;

  if (!name || !category || !status) {
    return res.status(400).json({ error: "Missing required fields: name, category, status" });
  }

  if (!["Office", "Vehicle", "Residential"].includes(category)) {
    return res.status(400).json({ error: "Category must be either Office, Vehicle, or Residential" });
  }

  if (!["available", "checked_out", "lost"].includes(status)) {
    return res.status(400).json({ error: "Status must be either available, checked_out, or lost" });
  }

  try {
    // Check if key exists
    const keyCheck = await db.query("SELECT * FROM keys WHERE key_id = $1", [keyId]);
    if (keyCheck.rows.length === 0) {
      return res.status(404).json({ error: `Key with ID '${keyId}' not found` });
    }

    // Validate holder user exists if provided
    let holderId = null;
    if (currentHolderId) {
      const userCheck = await db.query("SELECT user_id FROM users WHERE user_id = $1", [currentHolderId]);
      if (userCheck.rows.length === 0) {
        return res.status(400).json({ error: `Current holder user ID '${currentHolderId}' does not exist` });
      }
      holderId = currentHolderId;
    }

    // Update keys
    const latitude = lat !== undefined && lat !== null ? parseFloat(lat) : null;
    const longitude = lng !== undefined && lng !== null ? parseFloat(lng) : null;

    await db.query(
      `UPDATE keys 
       SET name = $1, category = $2, status = $3, current_holder_id = $4, latitude = $5, longitude = $6, last_updated = CURRENT_TIMESTAMP
       WHERE key_id = $7`,
      [name, category, status, holderId, latitude, longitude, keyId]
    );

    return res.json({
      message: "Key updated successfully",
      key: {
        id: keyId,
        name,
        category,
        status,
        currentHolderId: holderId,
        lat: latitude,
        lng: longitude
      }
    });
  } catch (err) {
    console.error("Update key error:", err);
    return res.status(500).json({ error: "Internal server error updating key" });
  }
}

/**
 * Delete key: DELETE /api/keys/:keyId (Admin only)
 */
export async function deleteKey(req, res) {
  const { keyId } = req.params;

  try {
    const keyCheck = await db.query("SELECT key_id FROM keys WHERE key_id = $1", [keyId]);
    if (keyCheck.rows.length === 0) {
      return res.status(404).json({ error: `Key with ID '${keyId}' not found` });
    }

    // Deletes key (with cascading deletes on logs)
    await db.query("DELETE FROM keys WHERE key_id = $1", [keyId]);

    return res.json({ message: `Key with ID '${keyId}' deleted successfully` });
  } catch (err) {
    console.error("Delete key error:", err);
    return res.status(500).json({ error: "Internal server error deleting key" });
  }
}
