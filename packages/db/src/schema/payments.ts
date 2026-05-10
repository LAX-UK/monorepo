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
import { legalEntity } from "./legal-entities.js";
import { lot } from "./lots.js";

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
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("payment_lot_id_idx").on(table.lotId),
    index("payment_buyer_id_idx").on(table.buyerId),
    index("payment_buyer_legal_entity_id_idx").on(table.buyerLegalEntityId),
    index("payment_seller_legal_entity_id_idx").on(table.sellerLegalEntityId),
    uniqueIndex("payment_stripe_charge_id_uidx")
      .on(table.stripeChargeId)
      .where(sql`${table.stripeChargeId} is not null`),
    uniqueIndex("payment_lot_buyer_open_unique")
      .on(table.lotId, table.buyerId)
      .where(
        sql`${table.status} in ('pending', 'authorized', 'captured', 'requires_manual_review')`,
      ),
    index("payment_buyer_id_status_idx").on(table.buyerId, table.status),
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
