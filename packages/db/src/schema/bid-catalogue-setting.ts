import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Staff-controlled switches for LAX Bid's catalogue, one row per switch. Absent means off. The
 * first is "block publishing originals that are not linked to Zoho"; it mirrors the switch LAX
 * Shop keeps for lax.art in `shop_catalogue_setting`.
 */
export const bidCatalogueSetting = pgTable("bid_catalogue_setting", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  updatedBy: text("updated_by"),
});
