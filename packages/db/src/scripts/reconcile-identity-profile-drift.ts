import { sql } from "drizzle-orm";
import { closeDb, createDb } from "../client.js";

/**
 * Drift detection for presence and every Bid-owned migration-era compatibility column.
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
        count(*) FILTER (WHERE u.id IS NULL)::int AS orphan_profiles,
        count(*) FILTER (
          WHERE p.user_id IS NOT NULL
            AND u.id IS NOT NULL
            AND (
              p.role IS DISTINCT FROM u.role OR
              p.staff_role IS DISTINCT FROM u.staff_role OR
              p.email_status IS DISTINCT FROM u.email_status OR
              p.email_status_changed_at IS DISTINCT FROM u.email_status_changed_at OR
              p.suspended_at IS DISTINCT FROM u.suspended_at OR
              p.suspended_reason IS DISTINCT FROM u.suspended_reason OR
              p.kyc_status IS DISTINCT FROM u.kyc_status OR
              p.current_kyc_session_id IS DISTINCT FROM u.current_kyc_session_id OR
              p.kyc_retry_count IS DISTINCT FROM u.kyc_retry_count OR
              p.kyc_verified_at IS DISTINCT FROM u.kyc_verified_at OR
              p.preferred_paddle_number IS DISTINCT FROM u.preferred_paddle_number OR
              p.aml_hold_status IS DISTINCT FROM u.aml_hold_status OR
              p.aml_hold_reason IS DISTINCT FROM u.aml_hold_reason OR
              p.aml_hold_at IS DISTINCT FROM u.aml_hold_at OR
              p.signup_persona IS DISTINCT FROM u.signup_persona OR
              p.date_of_birth IS DISTINCT FROM u.date_of_birth OR
              p.first_name IS DISTINCT FROM u.first_name OR
              p.last_name IS DISTINCT FROM u.last_name OR
              p.mobile IS DISTINCT FROM u.mobile OR
              p.mobile_country IS DISTINCT FROM u.mobile_country OR
              p.has_seen_acting_context_tooltip IS DISTINCT FROM
                u.has_seen_acting_context_tooltip OR
              p.identity_disabled_at IS DISTINCT FROM u.identity_disabled_at OR
              p.merged_into_subject_id IS DISTINCT FROM u.merged_into_subject_id
            )
        )::int AS mismatched_profiles
      FROM public."user" u
      FULL OUTER JOIN public.bid_user_profile p ON p.user_id = u.id
    `);
    const row = result.rows[0] as
      | {
          missing_profiles?: number;
          orphan_profiles?: number;
          mismatched_profiles?: number;
        }
      | undefined;
    const missing = Number(row?.missing_profiles ?? 0);
    const orphan = Number(row?.orphan_profiles ?? 0);
    const mismatched = Number(row?.mismatched_profiles ?? 0);
    if (missing > 0 || orphan > 0 || mismatched > 0) {
      console.error(
        `identity profile drift: missing=${missing} orphan=${orphan} mismatched=${mismatched}`,
      );
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
