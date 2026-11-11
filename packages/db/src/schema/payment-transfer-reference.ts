import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * The reference a bank-transfer payment tells the sender to quote, by payment intent. The payment
 * provider stops showing it once the payment completes; this keeps it so a transfer applied to a
 * different invoice than its reference names can be recognised and both invoices named. The
 * payment ids carry no foreign key: the record is written from provider events, which may name a
 * payment of any kind, and a missing invoice must never fail the event.
 */
export const paymentTransferReference = pgTable(
  "payment_transfer_reference",
  {
    stripePaymentIntentId: text("stripe_payment_intent_id").primaryKey(),
    reference: text("reference").notNull(),
    paymentId: uuid("payment_id"),
    paymentGroupId: uuid("payment_group_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("payment_transfer_reference_reference_idx").on(sql`upper(${table.reference})`)],
);
