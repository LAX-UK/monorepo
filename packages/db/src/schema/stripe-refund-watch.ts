import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Every status Stripe gives a refund. */
export const STRIPE_REFUND_STATUSES = [
  "pending",
  "requires_action",
  "succeeded",
  "failed",
  "canceled",
] as const;
export type StripeRefundStatus = (typeof STRIPE_REFUND_STATUSES)[number];

/**
 * A Stripe refund seen pending or requires_action, kept until Stripe reports it succeeded, failed
 * or cancelled. The refund reconcile job re-reads each due row (with backoff) and settles the
 * charge's totals through the webhook's own path once the refund is final, so a refund that
 * finishes later is counted even when no `charge.refund.updated` event is delivered.
 */
export const stripeRefundWatch = pgTable(
  "stripe_refund_watch",
  {
    stripeRefundId: text("stripe_refund_id").primaryKey(),
    stripeChargeId: text("stripe_charge_id").notNull(),
    /** The status last read from Stripe. */
    status: text("status").notNull(),
    amountPence: integer("amount_pence").notNull(),
    /** The invoice the refund names, when it names one (for reports only). */
    paymentId: uuid("payment_id"),
    /**
     * Set for a refund staff made that Stripe had not finished: who made it and why, so it is
     * recorded as their refund once it succeeds (and not at all if it fails).
     */
    staffRefund: jsonb("staff_refund").$type<Record<string, unknown>>(),
    attempts: integer("attempts").notNull().default(0),
    nextCheckAt: timestamp("next_check_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    lastError: text("last_error"),
    /** Set once the refund was final and the charge was settled from it. */
    settledAt: timestamp("settled_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("stripe_refund_watch_due_idx")
      .on(table.nextCheckAt)
      .where(sql`${table.settledAt} IS NULL`),
    index("stripe_refund_watch_charge_idx").on(table.stripeChargeId),
    check(
      "stripe_refund_watch_status_ck",
      sql`${table.status} IN ('pending', 'requires_action', 'succeeded', 'failed', 'canceled')`,
    ),
    check("stripe_refund_watch_amount_ck", sql`${table.amountPence} >= 0`),
    check("stripe_refund_watch_attempts_ck", sql`${table.attempts} >= 0`),
  ],
);
