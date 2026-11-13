import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { bidInvoice } from "./bid-invoice.js";
import { legalEntity } from "./legal-entities.js";
import { lot } from "./lots.js";
import { paymentGroup } from "./payment-group.js";

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "authorized",
  "captured",
  "refunded",
  "requires_manual_review",
  "cancelled",
]);

export const payment = pgTable(
  "payment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lot.id, { onDelete: "cascade" }),
    buyerId: text("buyer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    buyerLegalEntityId: uuid("buyer_legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    sellerLegalEntityId: uuid("seller_legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    platformFee: numeric("platform_fee", { precision: 18, scale: 2 }).notNull(),
    /** Nullable external id from the chosen payment gateway (DB column name is legacy). */
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    /** Stripe Charge id (`ch_...`) used by dispute/refund webhook lookups. */
    stripeChargeId: text("stripe_charge_id"),
    /** Stripe Refund id (`re_...`) after an admin-initiated refund. */
    stripeRefundId: text("stripe_refund_id"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    /**
     * What the invoice's own bank transfer has delivered so far, in whole pence, from Stripe's
     * partially-funded notice. Only ever raised, never above the invoice; 0 for an invoice paid
     * through a group, whose figure is the group's `amount_received`.
     */
    transferReceivedPence: integer("transfer_received_pence").notNull().default(0),
    /**
     * The payment intent whose partially-funded notice set `transfer_received_pence`. A notice for
     * another intent replaces the figure, and it is shown only while it is the invoice's current
     * intent's, so money sent to an earlier attempt is never shown against a new one.
     */
    transferReceivedPaymentIntentId: text("transfer_received_payment_intent_id"),
    /**
     * The "Pay several" payment this invoice is settled through, if any. Set while the group's
     * checkout is open and kept once it is paid; cleared when the group is cancelled.
     */
    paymentGroupId: uuid("payment_group_id").references(() => paymentGroup.id, {
      onDelete: "restrict",
    }),
    /** The invoice this payment settles; a retried payment row points at the same invoice. */
    invoiceId: uuid("invoice_id").references(() => bidInvoice.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("payment_invoice_id_idx").on(table.invoiceId).where(sql`${table.invoiceId} is not null`),
    index("payment_lot_id_idx").on(table.lotId),
    index("payment_buyer_id_idx").on(table.buyerId),
    index("payment_buyer_legal_entity_id_idx").on(table.buyerLegalEntityId),
    index("payment_seller_legal_entity_id_idx").on(table.sellerLegalEntityId),
    // One charge settles one invoice, except a "Pay several" charge, which every invoice in its
    // group shares (the group holds that charge once, uniquely).
    uniqueIndex("payment_stripe_charge_id_uidx")
      .on(table.stripeChargeId)
      .where(sql`${table.stripeChargeId} is not null and ${table.paymentGroupId} is null`),
    index("payment_payment_group_id_idx")
      .on(table.paymentGroupId)
      .where(sql`${table.paymentGroupId} is not null`),
    uniqueIndex("payment_lot_buyer_open_unique")
      .on(table.lotId, table.buyerId)
      .where(
        sql`${table.status} in ('pending', 'authorized', 'captured', 'requires_manual_review')`,
      ),
    uniqueIndex("payment_lot_buyer_open_account_unique")
      .on(table.lotId, table.buyerLegalEntityId)
      .where(
        sql`${table.status} in ('pending', 'authorized', 'captured', 'requires_manual_review')`,
      ),
    index("payment_reminder_candidate_idx")
      .on(table.createdAt)
      .where(sql`${table.status} in ('pending', 'cancelled')`),
    index("payment_buyer_id_status_idx").on(table.buyerId, table.status),
    check("payment_transfer_received_pence_check", sql`${table.transferReceivedPence} >= 0`),
  ],
);

export const paymentRelations = relations(payment, ({ one }) => ({
  lot: one(lot, {
    fields: [payment.lotId],
    references: [lot.id],
  }),
  buyer: one(user, {
    fields: [payment.buyerId],
    references: [user.id],
  }),
  buyerLegalEntity: one(legalEntity, {
    fields: [payment.buyerLegalEntityId],
    references: [legalEntity.id],
  }),
  sellerLegalEntity: one(legalEntity, {
    fields: [payment.sellerLegalEntityId],
    references: [legalEntity.id],
  }),
}));
