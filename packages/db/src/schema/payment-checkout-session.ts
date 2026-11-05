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
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("payment_checkout_session_payment_id_idx").on(table.paymentId)],
);
