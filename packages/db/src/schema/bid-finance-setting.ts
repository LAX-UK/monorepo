import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * The Bid company's own finance settings, one row per setting. `commission_vat_treatment` says
 * whether commission carries VAT (`standard`) or the company is not VAT-registered
 * (`not_registered`). A missing row means "not set", and seller payouts are held until it is.
 */
export const bidFinanceSetting = pgTable("bid_finance_setting", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  updatedBy: text("updated_by"),
});
