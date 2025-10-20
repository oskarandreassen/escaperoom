// lib/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool);

// Liten sanity-check helper
export async function ping() {
  const client = await pool.connect();
  try {
    const res = await client.query("select 1 as ok");
    return res.rows[0]?.ok === 1;
  } finally {
    client.release();
  }
}
