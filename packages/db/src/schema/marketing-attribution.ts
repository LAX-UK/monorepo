import type { MarketingAttributionSnapshot } from "@auction/types";
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const marketingAttribution = pgTable("marketing_attribution", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  firstTouch: jsonb("first_touch").$type<MarketingAttributionSnapshot["firstTouch"]>(),
  lastTouch: jsonb("last_touch").$type<MarketingAttributionSnapshot["lastTouch"]>(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
});
