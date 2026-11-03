import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";
import { lot } from "./lots.js";
import { payment } from "./payments.js";

/**
 * A won lot whose buyer did not pay, as staff recorded it. The invoice it voided stays in
 * `payment` (cancelled), and this row says why: it is the record of the void, never deleted. The
 * buyer's purchase page reads it so the buyer can still see what happened after the lot has gone
 * back to inventory or been offered on.
 */
export const buyerDefault = pgTable(
  "buyer_default",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lot.id, { onDelete: "cascade" }),
    /** The voided invoice; `null` when the lot was won but no invoice was raised yet. */
    paymentId: uuid("payment_id").references(() => payment.id, { onDelete: "set null" }),
    buyerId: text("buyer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    buyerLegalEntityId: uuid("buyer_legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    sellerLegalEntityId: uuid("seller_legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    /** The hammer price and when the lot closed, kept as they were when the sale was won. */
    hammerPrice: numeric("hammer_price", { precision: 18, scale: 2 }).notNull(),
    wonAt: timestamp("won_at", { mode: "date", withTimezone: true }).notNull(),
    /** Staff's reason, kept with the audit entry. */
    reason: text("reason").notNull(),
    outcome: text("outcome").notNull(),
    /** The next bidder, when the lot is offered on. */
    offeredUserId: text("offered_user_id").references(() => user.id, { onDelete: "set null" }),
    offeredAmount: numeric("offered_amount", { precision: 18, scale: 2 }),
    /** Whether the buyer's bidding was restricted with the default. */
    buyerRestricted: boolean("buyer_restricted").notNull().default(false),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("buyer_default_lot_id_idx").on(table.lotId),
    index("buyer_default_buyer_entity_idx").on(table.buyerLegalEntityId, table.createdAt),
    // An invoice is voided once.
    uniqueIndex("buyer_default_payment_uidx")
      .on(table.paymentId)
      .where(sql`${table.paymentId} is not null`),
    check(
      "buyer_default_outcome_check",
      sql`${table.outcome} IN ('returned_to_inventory', 'offered_to_underbidder')`,
    ),
    check("buyer_default_reason_length", sql`char_length(${table.reason}) BETWEEN 1 AND 1000`),
  ],
);

/**
 * Which payment reminder went to the buyer for an invoice. The row is written before the
 * notice, so a repeated or parallel run finds the step taken and sends nothing more.
 */
export const paymentReminder = pgTable(
  "payment_reminder",
  {
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payment.id, { onDelete: "cascade" }),
    step: text("step").notNull(),
    sentAt: timestamp("sent_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.paymentId, table.step] }),
    check(
      "payment_reminder_step_check",
      sql`${table.step} IN ('before_due', 'due_day', 'overdue')`,
    ),
  ],
);
