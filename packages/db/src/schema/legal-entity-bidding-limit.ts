import { sql } from "drizzle-orm";
import { check, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";

/**
 * An organisation's optional bidding limit: the most everyone bidding for it may have committed
 * at once (leading and maximum bids, scheduled absentee bids and unpaid wins), owners and admins
 * included. No row means no organisation-wide limit. Changes are recorded as domain events.
 */
export const legalEntityBiddingLimit = pgTable(
  "legal_entity_bidding_limit",
  {
    legalEntityId: uuid("legal_entity_id")
      .primaryKey()
      .references(() => legalEntity.id, { onDelete: "cascade" }),
    /** GBP, major units. */
    limitAmount: numeric("limit_amount", { precision: 18, scale: 2 }).notNull(),
    setByUserId: text("set_by_user_id").references(() => user.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("legal_entity_bidding_limit_positive", sql`${table.limitAmount} > 0`)],
);
