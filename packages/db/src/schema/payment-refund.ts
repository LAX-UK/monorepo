import { relations, sql } from "drizzle-orm";
import {
  char,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { payment } from "./payments.js";

/** Where a buyer-side refund came from. */
export const PAYMENT_REFUND_SOURCES = [
  "card_webhook",
  "group_webhook",
  "staff",
  "blocked_capture",
  "payout_topup",
  /** A compensating row: a refund that was counted, then reported failed or cancelled by Stripe. */
  "refund_reversal",
] as const;
export type PaymentRefundSource = (typeof PAYMENT_REFUND_SOURCES)[number];

/**
 * What the buyer was given back for a payment: one row per refund (or per step of a refund
 * reported as a running total), written in the same transaction as the `payment.refunded` event.
 * The invoice document sums it. Append-only: a row is never changed or removed. A refund counted
 * and later reported failed is taken back by a negative `refund_reversal` row, never by an edit.
 */
export const paymentRefund = pgTable(
  "payment_refund",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payment.id, { onDelete: "restrict" }),
    /**
     * The `source_event_id` of the payout line the same refund writes: the Stripe event id,
     * `<event id>:<payment id>` for a Pay several charge, or the staff refund's own id.
     */
    idempotencyKey: text("idempotency_key").notNull(),
    /** The Stripe refund id, when one is known. */
    stripeRefundId: text("stripe_refund_id"),
    amountPence: integer("amount_pence").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("payment_refund_idempotency_key_uidx").on(table.idempotencyKey),
    index("payment_refund_payment_id_idx").on(table.paymentId),
    check(
      "payment_refund_amount_positive",
      sql`${table.amountPence} > 0 OR (${table.source} = 'refund_reversal' AND ${table.amountPence} < 0)`,
    ),
    check("payment_refund_currency_ck", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      "payment_refund_source_ck",
      sql`${table.source} IN ('card_webhook', 'group_webhook', 'staff', 'blocked_capture', 'payout_topup', 'refund_reversal')`,
    ),
  ],
);

export const paymentRefundRelations = relations(paymentRefund, ({ one }) => ({
  payment: one(payment, {
    fields: [paymentRefund.paymentId],
    references: [payment.id],
  }),
}));
