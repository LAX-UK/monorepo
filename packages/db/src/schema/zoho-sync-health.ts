import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * What staff need to see about the Zoho connection that no other table holds: the sync modes the
 * worker runs with and how the OAuth token refresh is doing. One row, written by the worker and
 * read by LAX Admin's Sync health tab. Constraints are in migration 0366.
 */
export const zohoSyncHealth = pgTable("zoho_sync_health", {
  /** Always `zoho`: the table holds one row. */
  id: text("id").primaryKey().default("zoho"),
  /** The worker's `ZOHO_ARTWORK_SYNC_MODE` when it last started; null before the first report. */
  artworkSyncMode: text("artwork_sync_mode").$type<"off" | "dry_run" | "live">(),
  /** The worker's `ZOHO_ARTWORK_LISTING_MODE` when it last started. */
  listingMode: text("listing_mode").$type<"off" | "dry_run" | "live">(),
  modesReportedAt: timestamp("modes_reported_at", { mode: "date", withTimezone: true }),
  /** The last time Zoho gave the worker a fresh access token. */
  tokenRefreshedAt: timestamp("token_refreshed_at", { mode: "date", withTimezone: true }),
  /** When that access token stops working. */
  tokenExpiresAt: timestamp("token_expires_at", { mode: "date", withTimezone: true }),
  /** Refreshes that failed since the last good one. */
  tokenFailureStreak: integer("token_failure_streak").notNull().default(0),
  tokenLastFailureAt: timestamp("token_last_failure_at", { mode: "date", withTimezone: true }),
  /** A short code, never Zoho's response text: for example `zoho_token_refresh_failed_400`. */
  tokenLastFailureCode: text("token_last_failure_code"),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
});
