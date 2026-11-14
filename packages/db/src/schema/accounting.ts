import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * A document to send to the accounting provider (Xero or Zoho Books), one row per LAX reference and
 * target (provider and mode).
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
    /** The provider and mode the document was created for; both null when nothing could be chosen. Never updated. */
    targetProvider: text("target_provider").$type<"xero" | "books">(),
    targetMode: text("target_mode").$type<"dry_run" | "test_org" | "live">(),
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
    // One document per reference and target (migration 0374): a rehearsal in `dry_run` never
    // holds a reference the test or live organisation needs. Rows with no target share one slot.
    unique("accounting_document_reference_target_uq")
      .on(
        table.product,
        table.legalEntity,
        table.laxReference,
        table.targetProvider,
        table.targetMode,
      )
      .nullsNotDistinct(),
    index("accounting_document_claim_idx")
      .on(table.createdAt, table.id)
      .where(sql`${table.state} IN ('pending', 'sending')`),
    index("accounting_document_state_idx").on(table.state, table.updatedAt),
  ],
);

/**
 * LAX's own copy of the PDF the provider made for an issued document (migration 0381), kept in
 * document storage under `storageKey`. Buyers download this copy.
 *
 * The "Your invoice" email is settled from the row once: queued (`emailQueuedAt` and
 * `emailOutboxId`) or skipped for good (`emailSkippedAt` and `emailSkipReason`), never both. A
 * trigger makes those four columns write-once (NULL to a value only). `no_rehearsal_email_ck`
 * refuses to record a rehearsal as emailed; it constrains the record, not the send (the email is
 * enqueued before it is noted here), so the worker's query and service are what keep rehearsals
 * out of the outbox.
 */
export const accountingDocumentCopy = pgTable(
  "accounting_document_copy",
  {
    documentId: uuid("document_id")
      .primaryKey()
      .references(() => accountingDocument.id, { onDelete: "restrict" }),
    storageKey: text("storage_key").notNull().unique("accounting_document_copy_storage_key_uq"),
    contentType: text("content_type")
      .$type<"application/pdf">()
      .notNull()
      .default("application/pdf"),
    byteSize: integer("byte_size").notNull(),
    sha256: text("sha256").notNull(),
    /** Made by a dry run (a page that says so), not by the provider. */
    rehearsal: boolean("rehearsal").notNull(),
    storedAt: timestamp("stored_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    emailQueuedAt: timestamp("email_queued_at", { mode: "date", withTimezone: true }),
    emailOutboxId: uuid("email_outbox_id"),
    /** When the email was settled without sending (the invoice was cancelled, nobody to send to). */
    emailSkippedAt: timestamp("email_skipped_at", { mode: "date", withTimezone: true }),
    emailSkipReason: text("email_skip_reason"),
  },
  (table) => [
    check(
      "accounting_document_copy_content_type_ck",
      sql`${table.contentType} = 'application/pdf'`,
    ),
    check(
      "accounting_document_copy_size_ck",
      sql`${table.byteSize} > 0 AND ${table.byteSize} <= 10485760`,
    ),
    check("accounting_document_copy_sha256_ck", sql`${table.sha256} ~ '^[0-9a-f]{64}$'`),
    check(
      "accounting_document_copy_email_pair_ck",
      sql`(${table.emailQueuedAt} IS NULL) = (${table.emailOutboxId} IS NULL)`,
    ),
    check(
      "accounting_document_copy_no_rehearsal_email_ck",
      sql`NOT (${table.rehearsal} AND ${table.emailQueuedAt} IS NOT NULL)`,
    ),
    check(
      "accounting_document_copy_email_skip_pair_ck",
      sql`(${table.emailSkippedAt} IS NULL) = (${table.emailSkipReason} IS NULL)`,
    ),
    check(
      "accounting_document_copy_email_settled_once_ck",
      sql`${table.emailQueuedAt} IS NULL OR ${table.emailSkippedAt} IS NULL`,
    ),
    check(
      "accounting_document_copy_email_skip_reason_ck",
      sql`${table.emailSkipReason} IS NULL OR ${table.emailSkipReason} ~ '^[a-z_]{1,64}$'`,
    ),
    index("accounting_document_copy_email_due_idx")
      .on(table.storedAt)
      .where(
        sql`${table.emailQueuedAt} IS NULL AND ${table.emailSkippedAt} IS NULL AND NOT ${table.rehearsal}`,
      ),
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

/**
 * The nightly Books status check (migration 0385): the last state read from the provider for each
 * issued document, and when a Books notice asked for it to be read again. Books is never trusted to
 * move money in LAX; this records what it said. Worker only.
 */
export const accountingBooksStatus = pgTable("accounting_books_status", {
  documentId: uuid("document_id")
    .primaryKey()
    .references(() => accountingDocument.id, { onDelete: "restrict" }),
  /** Null until first read (a notice may ask for a read before the check ever looked). */
  booksState: text("books_state"),
  balancePence: bigint("balance_pence", { mode: "number" }),
  /** Every Books payment id seen against the document, sorted. */
  paymentIds: jsonb("payment_ids").$type<string[]>().notNull().default([]),
  checkedAt: timestamp("checked_at", { mode: "date", withTimezone: true }),
  changedAt: timestamp("changed_at", { mode: "date", withTimezone: true }),
  recheckRequestedAt: timestamp("recheck_requested_at", { mode: "date", withTimezone: true }),
});

/** What the status check saw change in Books, append-only (a trigger refuses any change). */
export const accountingBooksStatusChange = pgTable(
  "accounting_books_status_change",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => accountingDocument.id, { onDelete: "restrict" }),
    change: text("change").$type<"state_changed" | "payment_recorded_in_books">().notNull(),
    fromState: text("from_state"),
    toState: text("to_state"),
    booksPaymentId: text("books_payment_id"),
    amountPence: bigint("amount_pence", { mode: "number" }),
    observedAt: timestamp("observed_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("accounting_books_status_change_document_idx").on(table.documentId)],
);

/** One row per nightly status check run, so a missed run can be told. */
export const accountingBooksStatusRun = pgTable("accounting_books_status_run", {
  id: uuid("id").primaryKey().defaultRandom(),
  startedAt: timestamp("started_at", { mode: "date", withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { mode: "date", withTimezone: true }),
  outcome: text("outcome").$type<"completed" | "budget_spent" | "rehearsal" | "failed">(),
  checked: integer("checked").notNull().default(0),
  changed: integer("changed").notNull().default(0),
  tasks: integer("tasks").notNull().default(0),
});
