const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // Enable SSL when required by your hosted PostgreSQL provider.
  ssl:
    process.env.DB_SSL === "true"
      ? { rejectUnauthorized: false }
      : false,

  connectionTimeoutMillis: 10000,
});

pool.on("error", (error) => {
  console.error(
    "Unexpected PostgreSQL pool error:",
    error.message
  );
});

module.exports = pool;