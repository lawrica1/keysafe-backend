import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// Establish PostgreSQL pool using connection string
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

export default {
  query: (text, params) => pool.query(text, params),
  pool
};
