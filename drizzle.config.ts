// drizzle.config.ts
import "dotenv/config";
import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/schema.ts",   // justera om din schemafil ligger annanstans
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
} satisfies Config;
