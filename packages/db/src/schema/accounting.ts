import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * A document to send to the accounting provider (Xero or Zoho Books), one row per LAX reference.
 * The columns follow the accounting domain's life cycle (`@auction/accounting-domain`): which of
 * them may be set in which `state` is enforced by CHECK constraints in migration 0368, repeated
 * here only where drizzle-kit needs the columns. Times are timestamptz; the domain's epoch
 * milliseconds are converted at the repository boundary.
 */
export const accountingDocument = pgTable(
  "accounting_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    product: text("product").$type<"bid" | "shop" | "lax_art">().notNull(),
    legalEntity: text("legal_entity")
      .$type<"london_auction_xchange" | "london_art_exchange">()
      .notNull(),
    kind: text("kind")
      .$type<"invoice" | "payment" | "credit_note" | "bill" | "contact">()
      .notNull(),
    laxReference: text("lax_reference").notNull(),
    sourceEventRef: text("source_event_ref").notNull(),
    /** The document the domain built; the repository checks it against the columns on every read. */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    netPence: bigint("net_pence", { mode: "number" }).notNull(),
    vatPence: bigint("vat_pence", { mode: "number" }).notNull(),
    grossPence: bigint("gross_pence", { mode: "number" }).notNull(),
    state: text("state")
      .$type<
        "pending" | "sending" | "issued" | "unknown" | "needs_review" | "failed" | "cancelled"
      >()
      .notNull()
      .default("pending"),
    provider: text("provider").$type<"xero" | "books">(),
    providerId: text("provider_id"),
    providerNumber: text("provider_number"),
    pdfRef: text("pdf_ref"),
    leaseToken: text("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at", { mode: "date", withTimezone: true }),
    settlesAt: timestamp("settles_at", { mode: "date", withTimezone: true }),
    reviewLookup: text("review_lookup").$type<"owed" | "clear">(),
    mismatchField: text("mismatch_field").$type<"netPence" | "vatPence" | "grossPence">(),
    mismatchDifferencePence: bigint("mismatch_difference_pence", { mode: "number" }),
    attempts: integer("attempts").notNull().default(0),
    lastErrorClass: text("last_error_class"),
    needsReviewReason: text("needs_review_reason"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("accounting_document_reference_uid").on(
      table.product,
      table.legalEntity,
      table.laxReference,
    ),
    index("accounting_document_claim_idx")
      .on(table.createdAt, table.id)
      .where(sql`${table.state} IN ('pending', 'sending')`),
    index("accounting_document_state_idx").on(table.state, table.updatedAt),
  ],
);

/** What happened to a document, one row per transition. Append-only (trigger and grants). */
export const accountingDocumentEvent = pgTable(
  "accounting_document_event",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => accountingDocument.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    fromState: text("from_state"),
    toState: text("to_state").notNull(),
    attempts: integer("attempts").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [index("accounting_document_event_document_idx").on(table.documentId, table.id)],
);

/**
 * One row per product: the mode of each provider, at most one live (CHECK constraint). `liveSource`
 * is generated from the two modes.
 */
export const accountingSourceSetting = pgTable("accounting_source_setting", {
  product: text("product").$type<"bid" | "shop" | "lax_art">().primaryKey(),
  xeroMode: text("xero_mode")
    .$type<"off" | "dry_run" | "test_org" | "live">()
    .notNull()
    .default("off"),
  booksMode: text("books_mode")
    .$type<"off" | "dry_run" | "test_org" | "live">()
    .notNull()
    .default("off"),
  liveSource: text("live_source")
    .$type<"xero" | "books" | "none">()
    .notNull()
    .generatedAlwaysAs(
      sql`CASE WHEN "xero_mode" = 'live' THEN 'xero' WHEN "books_mode" = 'live' THEN 'books' ELSE 'none' END`,
    ),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  updatedBy: text("updated_by"),
});
