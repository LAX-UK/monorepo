import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * The reference a bank-transfer payment tells the sender to quote, by payment intent. The payment
 * provider stops showing it once the payment completes; this keeps it so a transfer applied to a
 * different invoice than its reference names can be recognised and both invoices named. Only
 * references we issued are kept. The payment and deal ids carry no foreign key: the record is
 * written from provider events, and a missing invoice must never fail the event. Append-only, and
 * kept with the payment's own records (a reference is an issued code, not personal data).
 */
export const paymentTransferReference = pgTable(
  "payment_transfer_reference",
  {
    stripePaymentIntentId: text("stripe_payment_intent_id").primaryKey(),
    reference: text("reference").notNull(),
    /** The buyer's customer at the provider: a reference is only looked up within its buyer. */
    stripeCustomerId: text("stripe_customer_id"),
    paymentId: uuid("payment_id"),
    paymentGroupId: uuid("payment_group_id"),
    /** The invoices a combined payment held when its reference was shown (it may be let go later). */
    memberPaymentIds: uuid("member_payment_ids").array().notNull().default(sql`'{}'::uuid[]`),
    privateSaleDealId: uuid("private_sale_deal_id"),
    privateSaleDealPaymentId: uuid("private_sale_deal_payment_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("payment_transfer_reference_customer_idx").on(
      table.stripeCustomerId,
      table.createdAt.desc(),
    ),
  ],
);
