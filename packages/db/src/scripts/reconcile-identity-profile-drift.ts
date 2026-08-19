import { sql } from "drizzle-orm";
import { closeDb, createDb } from "../client.js";

/**
 * Drift detection for Bid profile presence after `user` contracts to Identity-only.
 * Run with DATABASE_URL_OWNER.
 */
async function main() {
  const url = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_OWNER required");
  const db = createDb(url);
  try {
    const result = await db.execute(sql`
      SELECT
        count(*) FILTER (WHERE p.user_id IS NULL)::int AS missing_profiles,
        count(*) FILTER (WHERE u.id IS NULL)::int AS orphan_profiles
      FROM identity."user" u
      FULL OUTER JOIN public.bid_user_profile p ON p.user_id = u.id
    `);
    const row = result.rows[0] as
      | {
          missing_profiles?: number;
          orphan_profiles?: number;
        }
      | undefined;
    const missing = Number(row?.missing_profiles ?? 0);
    const orphan = Number(row?.orphan_profiles ?? 0);
    if (missing > 0 || orphan > 0) {
      console.error(`identity profile drift: missing=${missing} orphan=${orphan}`);
      process.exitCode = 1;
      return;
    }
    console.log("identity profile reconciliation ok");
  } finally {
    await closeDb(db);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
