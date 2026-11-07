import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export type ZohoCampaignsSuppressionMode = "dry_run" | "live";

/**
 * How far the Zoho Campaigns suppression sync has read: the newest unsubscribe or hard-bounce
 * time already handled. One row per mode, so switching from dry run to live starts with a full
 * read of its own. Constraints are in migration 0323.
 */
export const zohoCampaignsSuppressionState = pgTable("zoho_campaigns_suppression_state", {
  mode: text("mode").$type<ZohoCampaignsSuppressionMode>().primaryKey(),
  watermark: timestamp("watermark", { mode: "date", withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
});

/**
 * When a person last asked for mail again, per address hash. The sync skips a Campaigns opt-out
 * whose time is at or before this, so a lift lasts; a newer unsubscribe applies again. It is a
 * table of its own because a lift can happen with no suppression row to hang it on. Written only
 * by `lift_zoho_campaigns_opt_out()` (migration 0323).
 */
export const zohoCampaignsOptOutLift = pgTable("zoho_campaigns_optout_lift", {
  emailHash: text("email_hash").primaryKey(),
  liftedAt: timestamp("lifted_at", { mode: "date", withTimezone: true }).notNull(),
});
