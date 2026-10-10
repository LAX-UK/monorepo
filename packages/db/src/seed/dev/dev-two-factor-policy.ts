import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { buildPgConnectionConfig } from "../../ssl.js";

const { Pool } = pg;

/**
 * Migration 0205 seeds the staff policy as required for real environments. Dev and
 * hermetic CI fixtures sign staff in with a password only, so the seed leaves 2FA optional.
 */
export async function seedDevTwoFactorPolicy(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const pool = new Pool(buildPgConnectionConfig(url));
  try {
    await drizzle(pool).execute(sql`
      INSERT INTO "identity_mfa_policy" ("scope", "required")
      VALUES ('staff', false)
      ON CONFLICT ("scope") WHERE "scope" = 'staff'
      DO UPDATE SET "required" = false, "set_by_subject_id" = NULL, "set_at" = now()
    `);
  } finally {
    await pool.end();
  }
}
