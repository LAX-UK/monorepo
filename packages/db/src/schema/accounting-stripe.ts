import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Which LAX product (and so which company and Books organisation) a Stripe account's own movements
 * belong to: its payouts and Stripe's own fees (migration 0386). One row per Stripe account LAX
 * reads; written by an engineer from the runbook, never by an application role. A balance
 * transaction of an account with no row here is never booked.
 */
export const accountingStripeAccount = pgTable(
  "accounting_stripe_account",
  {
    stripeAccountId: text("stripe_account_id").primaryKey(),
    product: text("product").$type<"bid" | "shop" | "lax_art">().notNull(),
    /** The Stripe balance (GBP, pence) at the start of `openingOn`, as Books clearing opened with it. */
    openingBalancePence: bigint("opening_balance_pence", { mode: "number" }),
    openingOn: date("opening_on", { mode: "string" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "accounting_stripe_account_id_ck",
      sql`${table.stripeAccountId} ~ '^acct_[A-Za-z0-9]{1,48}$'`,
    ),
    check(
      "accounting_stripe_account_product_ck",
      sql`${table.product} IN ('bid', 'shop', 'lax_art')`,
    ),
  ],
);

/**
 * How far the daily Stripe job has read each account: every balance transaction created before
 * `read_through` has a row in `accounting_stripe_balance_txn`. Only ever moves forward.
 */
export const accountingStripeCursor = pgTable("accounting_stripe_cursor", {
  stripeAccountId: text("stripe_account_id")
    .primaryKey()
    .references(() => accountingStripeAccount.stripeAccountId, { onDelete: "restrict" }),
  readThrough: timestamp("read_through", { mode: "date", withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

/**
 * One row per Stripe balance transaction read, and what was done with it (append-only): booked
 * (its fee and payout documents registered for Books), parked for a person (and why), nothing to
 * book, or not booked because Books was not aimed at the product. The primary key is the
 * idempotency guard: a transaction is decided once, however many runs read it.
 */
export const accountingStripeBalanceTxn = pgTable(
  "accounting_stripe_balance_txn",
  {
    stripeAccountId: text("stripe_account_id")
      .notNull()
      .references(() => accountingStripeAccount.stripeAccountId, { onDelete: "restrict" }),
    balanceTransactionId: text("balance_transaction_id").notNull(),
    type: text("type").notNull(),
    currency: text("currency").notNull(),
    amountPence: bigint("amount_pence", { mode: "number" }).notNull(),
    feePence: bigint("fee_pence", { mode: "number" }).notNull(),
    createdAtStripe: timestamp("created_at_stripe", { mode: "date", withTimezone: true }).notNull(),
    /** The London calendar day it was created: the day its documents are dated and reported on. */
    createdOn: date("created_on", { mode: "string" }).notNull(),
    sourceId: text("source_id"),
    payoutId: text("payout_id"),
    product: text("product").$type<"bid" | "shop" | "lax_art">(),
    outcome: text("outcome").$type<"booked" | "parked" | "nothing" | "not_aimed">().notNull(),
    parkReason: text("park_reason"),
    bookedFeePence: bigint("booked_fee_pence", { mode: "number" }).notNull().default(0),
    bookedPayoutPence: bigint("booked_payout_pence", { mode: "number" }).notNull().default(0),
    readAt: timestamp("read_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      name: "accounting_stripe_balance_txn_pk",
      columns: [table.stripeAccountId, table.balanceTransactionId],
    }),
    index("accounting_stripe_balance_txn_day_idx").on(table.product, table.createdOn),
  ],
);

/**
 * The daily reconciliation report per company: where it is stored (private object storage, never
 * the repository) and how many mismatches it found. One row per company and day; a re-run of a day
 * replaces its key and count.
 */
export const accountingReconciliationReport = pgTable(
  "accounting_reconciliation_report",
  {
    legalEntity: text("legal_entity")
      .$type<"london_auction_xchange" | "london_art_exchange">()
      .notNull(),
    reportDay: date("report_day", { mode: "string" }).notNull(),
    storageKey: text("storage_key").notNull(),
    mismatches: integer("mismatches").notNull(),
    generatedAt: timestamp("generated_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      name: "accounting_reconciliation_report_pk",
      columns: [table.legalEntity, table.reportDay],
    }),
  ],
);
