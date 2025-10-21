// lib/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is missing.");
}

// Validera att det faktiskt är en URL (ger tydligt fel om något är knas)
try {
  // kastar om url inte är giltig
  // @ts-ignore – används bara för validering
  new URL(url);
} catch {
  throw new Error(`Invalid DATABASE_URL format: "${url}"`);
}

// SSL: Neon/Vercel Postgres kräver oftast SSL. Sätt det per default, men låt local dev utan SSL funka.
const needsSSL =
  /neon\.tech|vercel-storage|aws\.amazonaws\.com|render\.com|azure|gcp/i.test(url) ||
  /sslmode=require/i.test(url);

const pool = new Pool({
  connectionString: url,
  ssl: needsSSL ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool);
