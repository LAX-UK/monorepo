import { sql } from "drizzle-orm";
import type { Database } from "../client.js";

/**
 * Records that a person asked for mail again and removes their Zoho Campaigns marketing opt-out.
 * It calls migration 0323's `lift_zoho_campaigns_opt_out()`, the one writer of a lift, so no role
 * needs DELETE on email_suppression. `onlyIfOlder` (the re-subscribe path) lifts only when such an
 * opt-out exists and is older than `at`. Returns true when an entry was removed.
 */
export async function liftZohoCampaignsOptOut(
  db: Database,
  emailHash: string,
  at: Date,
  options: { onlyIfOlder?: boolean } = {},
): Promise<boolean> {
  const result = await db.execute<{ removed: boolean }>(
    sql`select public.lift_zoho_campaigns_opt_out(${emailHash}, ${at.toISOString()}::timestamptz, ${options.onlyIfOlder ?? false}) as removed`,
  );
  return result.rows[0]?.removed === true;
}
