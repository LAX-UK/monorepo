import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { legalEntity } from "./legal-entities.js";
import { lot } from "./lots.js";

/**
 * The invoice for a won lot: raised once for a lot and buyer account, and kept across payment
 * retries. A payment row that is cancelled or expired and later raised again points at the same
 * invoice, so its due date never restarts. Amounts are whole pence in pounds sterling.
 *
 * `total_pence` always equals the sum of the invoice's lines and the amount of its payment.
 * `source` is `raised` for invoices raised by the application and `legacy_backfill` for invoices
 * reconstructed from payments that existed before invoices were stored.
 */
export const bidInvoice = pgTable(
  "bid_invoice",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lot.id, { onDelete: "cascade" }),
    buyerLegalEntityId: uuid("buyer_legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    sellerLegalEntityId: uuid("seller_legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    currency: text("currency").notNull().default("GBP"),
    totalPence: bigint("total_pence", { mode: "number" }).notNull(),
    raisedAt: timestamp("raised_at", { mode: "date", withTimezone: true }).notNull(),
    /** End of the London day the payment term runs to; stored once, read by every surface. */
    dueAt: timestamp("due_at", { mode: "date", withTimezone: true }).notNull(),
    /** The buyer's premium policy the lines were worked out with. */
    pricingPolicyId: text("pricing_policy_id"),
    /** Our own invoice number, assigned when the invoice document is issued. */
    number: text("number"),
    source: text("source").notNull().default("raised"),
    voidedAt: timestamp("voided_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One live invoice per lot and buyer account.
    uniqueIndex("bid_invoice_lot_buyer_live_uidx")
      .on(table.lotId, table.buyerLegalEntityId)
      .where(sql`${table.voidedAt} is null`),
    index("bid_invoice_buyer_legal_entity_id_idx").on(table.buyerLegalEntityId),
    index("bid_invoice_due_at_idx").on(table.dueAt).where(sql`${table.voidedAt} is null`),
    uniqueIndex("bid_invoice_number_uidx").on(table.number).where(sql`${table.number} is not null`),
    check("bid_invoice_currency_check", sql`${table.currency} = 'GBP'`),
    check("bid_invoice_total_check", sql`${table.totalPence} > 0`),
    check("bid_invoice_source_check", sql`${table.source} in ('raised', 'legacy_backfill')`),
  ],
);

export const bidInvoiceLine = pgTable(
  "bid_invoice_line",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => bidInvoice.id, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    ratePercent: numeric("rate_percent", { precision: 6, scale: 3 }),
    amountPence: bigint("amount_pence", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("bid_invoice_line_invoice_position_uidx").on(table.invoiceId, table.position),
    check(
      "bid_invoice_line_kind_check",
      sql`${table.kind} in ('hammer', 'buyers_premium', 'vat_on_hammer', 'import_vat', 'artists_resale_right', 'delivery', 'legacy_total')`,
    ),
    check("bid_invoice_line_amount_check", sql`${table.amountPence} >= 0`),
  ],
);

export type BidInvoiceRow = typeof bidInvoice.$inferSelect;
export type BidInvoiceLineRow = typeof bidInvoiceLine.$inferSelect;
