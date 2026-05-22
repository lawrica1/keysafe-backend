import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import db from "./index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seed() {
  console.log("Starting database seeding...");

  try {
    // 1. Read schema.sql
    const schemaPath = path.join(__dirname, "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");

    // 2. Execute schema.sql to drop and recreate tables
    console.log("Executing schema.sql...");
    await db.query(schemaSql);
    console.log("Schema initialized successfully.");

    // 3. Hash passwords for mock users
    console.log("Hashing user passwords...");
    const saltRounds = 10;
    const adminPasswordHash = await bcrypt.hash("admin123", saltRounds);
    const staffPasswordHash = await bcrypt.hash("staff123", saltRounds);
    const securityPasswordHash = await bcrypt.hash("security123", saltRounds);

    // 4. Seed users
    console.log("Inserting users...");
    const userInsertResult = await db.query(
      `INSERT INTO users (full_name, email, password_hash, role) VALUES
       ('Alex Admin', 'alex@keysafe.com', $1, 'admin'),
       ('Sam Staff', 'sam@keysafe.com', $2, 'staff'),
       ('Sarah Security', 'sarah@keysafe.com', $3, 'security')
       RETURNING user_id, full_name, role`,
      [adminPasswordHash, staffPasswordHash, securityPasswordHash]
    );
    
    const users = userInsertResult.rows;
    console.log(`Seeded ${users.length} users.`);
    
    const adminUser = users.find(u => u.role === 'admin');
    const staffUser = users.find(u => u.role === 'staff');
    const securityUser = users.find(u => u.role === 'security');

    // 5. Seed keys
    console.log("Inserting keys...");
    const keysToInsert = [
      {
        key_id: "tag-001-uuid",
        name: "Office Keycard",
        category: "Office",
        status: "available",
        current_holder_id: null,
        latitude: 51.5074,
        longitude: -0.1278
      },
      {
        key_id: "tag-002-uuid",
        name: "Delivery Van Key",
        category: "Vehicle",
        status: "checked_out",
        current_holder_id: staffUser.user_id,
        latitude: 51.5090,
        longitude: -0.1250
      },
      {
        key_id: "tag-003-uuid",
        name: "Master Key Fob",
        category: "Office",
        status: "lost",
        current_holder_id: null,
        latitude: 51.5050,
        longitude: -0.1300
      }
    ];

    for (const key of keysToInsert) {
      await db.query(
        `INSERT INTO keys (key_id, name, category, status, current_holder_id, latitude, longitude)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          key.key_id,
          key.name,
          key.category,
          key.status,
          key.current_holder_id,
          key.latitude,
          key.longitude
        ]
      );
    }
    console.log(`Seeded ${keysToInsert.length} keys.`);

    // 6. Seed tracking logs
    console.log("Inserting tracking logs...");
    const logsToInsert = [
      {
        key_id: "tag-001-uuid",
        reported_by: adminUser.full_name,
        gateway_id: `phone_${adminUser.user_id}`,
        rssi: -55,
        lat: 51.5074,
        lng: -0.1278
      },
      {
        key_id: "tag-002-uuid",
        reported_by: staffUser.full_name,
        gateway_id: `phone_${staffUser.user_id}`,
        rssi: -62,
        lat: 51.5085,
        lng: -0.1260
      },
      {
        key_id: "tag-002-uuid",
        reported_by: staffUser.full_name,
        gateway_id: `phone_${staffUser.user_id}`,
        rssi: -68,
        lat: 51.5090,
        lng: -0.1250
      },
      {
        key_id: "tag-003-uuid",
        reported_by: securityUser.full_name,
        gateway_id: `phone_${securityUser.user_id}`,
        rssi: -88, // Weak signal prior to being lost
        lat: 51.5050,
        lng: -0.1300
      }
    ];

    for (const log of logsToInsert) {
      await db.query(
        `INSERT INTO tracking_logs (key_id, reported_by, gateway_id, rssi, lat, lng)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [log.key_id, log.reported_by, log.gateway_id, log.rssi, log.lat, log.lng]
      );
    }
    console.log(`Seeded ${logsToInsert.length} tracking logs.`);

    // 7. Seed app config
    console.log("Inserting configuration defaults...");
    await db.query(
      `INSERT INTO app_config (config_key, config_value)
       VALUES ('rssi_threshold', '-85')`
    );
    console.log("Seeded app configuration.");

    console.log("Database seeding completed successfully!");
  } catch (err) {
    console.error("Database seeding failed:", err);
  } finally {
    // End connection pool
    await db.pool.end();
  }
}

seed();
