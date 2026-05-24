import { relations, sql } from "drizzle-orm";
import {
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
      "payout_status_check",
      sql`${table.status} IN ('scheduled', 'in_transit', 'paid', 'failed', 'reversed', 'clawback_pending')`,
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
        OR ${table.kind} IN ('refund', 'dispute', 'chargeback')
        OR ${table.paymentId} IS NOT NULL
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
