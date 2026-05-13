import { relations, sql } from "drizzle-orm";
import {
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { bid } from "./bids.js";
import { legalEntity } from "./legal-entities.js";
import { lot } from "./lots.js";

export const absenteeBidStatusEnum = pgEnum("absentee_bid_status", [
  "scheduled",
  "executing",
  "executed",
  "lost",
  "cancelled",
  "voided",
]);

export const absenteeBid = pgTable(
  "absentee_bid",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lot.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    buyerLegalEntityId: uuid("buyer_legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    maxAmount: numeric("max_amount", { precision: 18, scale: 2 }).notNull(),
    status: absenteeBidStatusEnum("status").notNull().default("scheduled"),
    /** Set when status becomes `executing`; cleared on terminal transitions. Used for lease expiry after crashes. */
    executingAt: timestamp("executing_at", { mode: "date", withTimezone: true }),
    executedBidId: uuid("executed_bid_id").references(() => bid.id, { onDelete: "set null" }),
    placedAt: timestamp("placed_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp("cancelled_at", { mode: "date", withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
  },
  (table) => [
    uniqueIndex("absentee_bid_lot_user_entity_scheduled_uidx")
      .on(table.lotId, table.userId, table.buyerLegalEntityId)
      .where(sql`${table.status} = 'scheduled'`),
    index("absentee_bid_lot_status_idx")
      .on(table.lotId, table.status)
      .where(sql`${table.status} = 'scheduled'`),
    index("absentee_bid_executing_lease_idx")
      .on(table.executingAt)
      .where(sql`${table.status} = 'executing'`),
  ],
);

export const absenteeBidRelations = relations(absenteeBid, ({ one }) => ({
  lot: one(lot, {
    fields: [absenteeBid.lotId],
    references: [lot.id],
  }),
}));
