import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { payment } from "./payments.js";

/**
 * Every Stripe Checkout session opened for one invoice. A session has no payment intent until
 * the buyer confirms, so this is the only way to find it again and close it at Stripe.
 */
export const paymentCheckoutSession = pgTable(
  "payment_checkout_session",
  {
    stripeSessionId: text("stripe_session_id").primaryKey(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payment.id, { onDelete: "cascade" }),
    /** "card" or "bank"; null for a session opened before the rail was recorded. */
    rail: text("rail"),
    /** Fingerprint of the checkout's parameters, so the same checkout finds its own session. */
    parametersFingerprint: text("parameters_fingerprint"),
    /** Set once the session is known to be closed (expired, or replaced by a newer one). */
    closedAt: timestamp("closed_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("payment_checkout_session_payment_id_idx").on(table.paymentId)],
);
