import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type ZohoArtworkSyncMode = "dry_run" | "live";
export type ZohoArtworkSyncOutcomeKind =
  | "create"
  | "update"
  | "conflict"
  | "unchanged"
  | "stale"
  | "skipped";

/**
 * How far the nightly check has read. One row per mode, so switching from dry run to live starts
 * a full pass of its own. Constraints are in migration 0288.
 */
export const zohoArtworkSyncState = pgTable("zoho_artwork_sync_state", {
  mode: text("mode").$type<ZohoArtworkSyncMode>().primaryKey(),
  watermark: timestamp("watermark", { mode: "date", withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
});

/** The result for one Product in one pass; in dry run this is the import report. */
export const zohoArtworkSyncOutcome = pgTable(
  "zoho_artwork_sync_outcome",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: text("run_id").notNull(),
    mode: text("mode").$type<ZohoArtworkSyncMode>().notNull(),
    zohoProductId: text("zoho_product_id").notNull(),
    stockCode: text("stock_code"),
    title: text("title"),
    outcome: text("outcome").$type<ZohoArtworkSyncOutcomeKind>().notNull(),
    reason: text("reason"),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    zohoModifiedAt: timestamp("zoho_modified_at", { mode: "date", withTimezone: true }),
    recordedAt: timestamp("recorded_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("zoho_artwork_sync_outcome_run_product_uid").on(table.runId, table.zohoProductId),
    index("zoho_artwork_sync_outcome_recorded_idx").on(table.recordedAt.desc(), table.id),
    index("zoho_artwork_sync_outcome_outcome_idx").on(table.runId, table.outcome),
  ],
);

export type ZohoListingRunFailureRow = { registerId: string; stockCode: string; code: string };

/**
 * One row per nightly pass of the LAX listing on Zoho Products: how many artworks it checked,
 * corrected (or in a dry run would have) and could not. Constraints are in migration 0317.
 */
export const zohoListingSyncRun = pgTable(
  "zoho_listing_sync_run",
  {
    runId: text("run_id").primaryKey(),
    mode: text("mode").$type<ZohoArtworkSyncMode>().notNull(),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { mode: "date", withTimezone: true }).notNull(),
    checked: integer("checked").notNull(),
    changed: integer("changed").notNull(),
    unchanged: integer("unchanged").notNull(),
    failed: integer("failed").notNull(),
    failures: jsonb("failures").$type<ZohoListingRunFailureRow[]>().notNull().default([]),
  },
  (table) => [index("zoho_listing_sync_run_finished_idx").on(table.finishedAt.desc())],
);
