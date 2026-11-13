import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";
import { payment } from "./payments.js";
import { privateSaleDeal } from "./private-sale-deal.js";
import { saleSellerTerms } from "./sale-seller-terms.js";

export const legalEntityPayoutMethod = pgTable(
  "legal_entity_payout_method",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legalEntityId: uuid("legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("stripe_connect"),
    stripeExternalAccountId: text("stripe_external_account_id"),
    isDefault: boolean("is_default").notNull().default(false),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    retiredAt: timestamp("retired_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    uniqueIndex("legal_entity_payout_method_default_uidx")
      .on(table.legalEntityId)
      .where(sql`${table.isDefault} = true AND ${table.status} = 'active'`),
    check("legal_entity_payout_method_status_check", sql`${table.status} IN ('active', 'retired')`),
  ],
);

export const payout = pgTable(
  "payout",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legalEntityId: uuid("legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    periodStart: timestamp("period_start", { mode: "date", withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { mode: "date", withTimezone: true }).notNull(),
    grossAmount: numeric("gross_amount", { precision: 18, scale: 2 }).notNull(),
    platformFee: numeric("platform_fee", { precision: 18, scale: 2 }).notNull(),
    stripeFee: numeric("stripe_fee", { precision: 18, scale: 2 }).notNull(),
    netAmount: numeric("net_amount", { precision: 18, scale: 2 }).notNull(),
    /**
     * The hammer, commission and VAT on commission of the lot sales on the payout, from their
     * seller-terms snapshots. Written together; empty on payouts made before payouts were paid
     * from the snapshot, which keep their stored figures.
     */
    hammerAmount: numeric("hammer_amount", { precision: 18, scale: 2 }),
    commissionAmount: numeric("commission_amount", { precision: 18, scale: 2 }),
    commissionVatAmount: numeric("commission_vat_amount", { precision: 18, scale: 2 }),
    currency: text("currency").notNull().default("GBP"),
    status: text("status").notNull().default("scheduled"),
    stripeTransferId: text("stripe_transfer_id").unique(),
    xeroBillId: text("xero_bill_id"),
    failureReason: text("failure_reason"),
    processedAt: timestamp("processed_at", { mode: "date", withTimezone: true }),
    /** public URL of cached PDF on Spaces (or local dev storage). */
    statementUrl: text("statement_url"),
    /** last terminal pdfkit / pipeline error after retries exhausted. */
    statementGenerationError: text("statement_generation_error"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("payout_entity_period_end_idx").on(table.legalEntityId, table.periodEnd),
    index("payout_status_period_end_idx").on(table.status, table.periodEnd),
    check("payout_period_coherence", sql`${table.periodEnd} > ${table.periodStart}`),
    check(
      "payout_accounting_integrity",
      sql`${table.netAmount} = ${table.grossAmount} - ${table.platformFee} - ${table.stripeFee}`,
    ),
    check("payout_currency_gbp", sql`${table.currency} = 'GBP'`),
    check(
      "payout_seller_terms_totals_ck",
      sql`(${table.hammerAmount} IS NULL AND ${table.commissionAmount} IS NULL AND ${table.commissionVatAmount} IS NULL) OR (${table.hammerAmount} IS NOT NULL AND ${table.commissionAmount} IS NOT NULL AND ${table.commissionVatAmount} IS NOT NULL AND ${table.hammerAmount} >= 0 AND ${table.commissionAmount} >= 0 AND ${table.commissionVatAmount} >= 0)`,
    ),
    check(
      "payout_status_check",
      sql`${table.status} IN ('scheduled', 'in_transit', 'paid', 'failed', 'reversed', 'clawback_pending', 'transfer_blocked')`,
    ),
  ],
);

export const payoutLine = pgTable(
  "payout_line",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    payoutId: uuid("payout_id")
      .notNull()
      .references(() => payout.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id").references(() => payment.id, {
      onDelete: "restrict",
    }),
    /** The private sale deal a sale line settles, in place of a lot payment. */
    privateSaleDealId: uuid("private_sale_deal_id").references(() => privateSaleDeal.id, {
      onDelete: "restrict",
    }),
    /** The seller-terms snapshot a lot's sale line pays: the line's amount is its hammer. */
    sellerTermsId: uuid("seller_terms_id").references(() => saleSellerTerms.id, {
      onDelete: "restrict",
    }),
    /**
     * On a refund line: the buyer's refund, in pence, that the line answers for. The seller is
     * charged back only their share of it, so the line's amount alone cannot say how much of the
     * buyer's refund the seller's ledger has already taken into account. Zero or more on a line
     * charging a refund; negative on a line giving back a refund that failed (the buyer refund it
     * reverses, with an amount of zero or more). Lines are always added up with their sign.
     */
    buyerRefundPence: bigint("buyer_refund_pence", { mode: "number" }),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    kind: text("kind").notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    note: text("note"),
    /** Stripe event ID for webhook-originated lines (idempotency). */
    sourceEventId: text("source_event_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("payout_line_payment_kind_uidx")
      .on(table.payoutId, table.paymentId, table.kind)
      .where(sql`${table.paymentId} IS NOT NULL`),
    uniqueIndex("payout_line_sale_payment_uidx")
      .on(table.paymentId)
      .where(sql`${table.kind} = 'sale' AND ${table.paymentId} IS NOT NULL`),
    // A deal is settled by one sale line, ever.
    uniqueIndex("payout_line_sale_deal_uidx")
      .on(table.privateSaleDealId)
      .where(sql`${table.kind} = 'sale' AND ${table.privateSaleDealId} IS NOT NULL`),
    uniqueIndex("payout_line_source_event_uidx")
      .on(table.payoutId, table.paymentId, table.kind, table.sourceEventId)
      .where(sql`${table.sourceEventId} IS NOT NULL`),
    check(
      "payout_line_adjustment_integrity",
      sql`(
        ${table.kind} != 'adjustment'
        OR (${table.createdByUserId} IS NOT NULL AND ${table.note} IS NOT NULL)
      )`,
    ),
    check(
      "payout_line_payment_required",
      sql`(
        ${table.kind} = 'adjustment'
        OR ${table.kind} IN ('refund', 'dispute', 'chargeback', 'reversal')
        OR ${table.paymentId} IS NOT NULL
        OR ${table.privateSaleDealId} IS NOT NULL
      )`,
    ),
    index("payout_line_seller_terms_idx")
      .on(table.sellerTermsId)
      .where(sql`${table.sellerTermsId} IS NOT NULL`),
    check(
      "payout_line_seller_terms_sale_ck",
      sql`${table.sellerTermsId} IS NULL OR (${table.kind} = 'sale' AND ${table.paymentId} IS NOT NULL)`,
    ),
    check(
      "payout_line_buyer_refund_ck",
      sql`${table.buyerRefundPence} IS NULL OR (${table.kind} = 'refund' AND (${table.buyerRefundPence} >= 0 OR ${table.amount} >= 0))`,
    ),
    // A line settles a lot payment or a deal, never both, and only a sale line settles a deal.
    check(
      "payout_line_one_subject",
      sql`(
        ${table.privateSaleDealId} IS NULL
        OR (${table.paymentId} IS NULL AND ${table.kind} = 'sale')
      )`,
    ),
  ],
);

export const legalEntityPayoutMethodRelations = relations(legalEntityPayoutMethod, ({ one }) => ({
  legalEntity: one(legalEntity, {
    fields: [legalEntityPayoutMethod.legalEntityId],
    references: [legalEntity.id],
  }),
}));

export const payoutRelations = relations(payout, ({ one, many }) => ({
  legalEntity: one(legalEntity, {
    fields: [payout.legalEntityId],
    references: [legalEntity.id],
  }),
  lines: many(payoutLine),
}));

export const payoutLineRelations = relations(payoutLine, ({ one }) => ({
  payout: one(payout, {
    fields: [payoutLine.payoutId],
    references: [payout.id],
  }),
  payment: one(payment, {
    fields: [payoutLine.paymentId],
    references: [payment.id],
  }),
  createdBy: one(user, {
    fields: [payoutLine.createdByUserId],
    references: [user.id],
  }),
}));
