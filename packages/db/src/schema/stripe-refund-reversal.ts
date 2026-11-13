import { sql } from "drizzle-orm";
import { check, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/** What a failed or cancelled Stripe refund can be taken back from. */
export const STRIPE_REFUND_REVERSAL_TARGETS = [
  /** The buyer's refund record of an invoice (`payment_refund`); target id: the payment id. */
  "buyer",
  /** The seller's refund payout lines of an invoice; target id: the payment id. */
  "seller",
  /** A courier quote's refunded figure on a Pay several group; target id: the quote id. */
  "delivery",
  /** A Pay several group's unattributed refund figure; target id: the group id. */
  "unattributed",
] as const;
export type StripeRefundReversalTarget = (typeof STRIPE_REFUND_REVERSAL_TARGETS)[number];

/**
 * Each failed or cancelled Stripe refund taken back from a record that had counted it: one row
 * per refund and record, so a refund is taken back at most once whichever path sees it (the
 * webhook, the refund reconcile job or the repair command). Append-only.
 */
export const stripeRefundReversal = pgTable(
  "stripe_refund_reversal",
  {
    stripeRefundId: text("stripe_refund_id").notNull(),
    target: text("target").notNull(),
    targetId: text("target_id").notNull(),
    /** What was taken back from the record for this refund, in pence. */
    amountPence: integer("amount_pence").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "stripe_refund_reversal_pk",
      columns: [table.stripeRefundId, table.target, table.targetId],
    }),
    check(
      "stripe_refund_reversal_target_ck",
      sql`${table.target} IN ('buyer', 'seller', 'delivery', 'unattributed')`,
    ),
    check("stripe_refund_reversal_amount_ck", sql`${table.amountPence} > 0`),
  ],
);
