// lib/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is missing.");
}

/**
 * Aktivera SSL ENDAST om:
 *  - querystring innehåller sslmode=require, eller
 *  - env PGSSLMODE=require, eller
 *  - env DB_SSL=true (manuell override för t.ex. Neon/Vercel)
 *
 * Lokalt (Docker / installerad Postgres) -> lämna allt detta tomt.
 */
const wantsSSL =
  /\bsslmode=require\b/i.test(url) ||
  /^require$/i.test(process.env.PGSSLMODE || "") ||
  /^true$/i.test(process.env.DB_SSL || "");

const pool = new Pool({
  connectionString: url,
  ssl: wantsSSL ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool);
