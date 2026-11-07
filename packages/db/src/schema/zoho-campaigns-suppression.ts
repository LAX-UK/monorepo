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
