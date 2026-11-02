import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";

/**
 * One person's request for a copy of their data ("Download my data"). Identity owns the request
 * and its state; the worker assembles the file and reports progress through an internal route.
 *
 * A person has at most one open request (`requested`, `collecting`, `delayed` or `ready`), which
 * the partial unique index enforces even under concurrent requests. `object_key` is never shown
 * to LAX Account: a download signs one short-lived GET for it after the owner, status and expiry
 * are checked. `object_purge_requested_at` is the durable instruction to delete the stored file,
 * set when the copy expires or the person deletes it, and cleared by `object_purged_at`.
 */
export const subjectDataExport = pgTable(
  "subject_data_export",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: text("subject_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("requested"),
    /** `{ account|bid|shop: waiting|collecting|done|retrying }`. */
    productProgress: jsonb("product_progress").notNull(),
    requestedAt: timestamp("requested_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    /** The legal due date: one calendar month after the request. */
    dueAt: timestamp("due_at", { mode: "date", withTimezone: true }).notNull(),
    readyAt: timestamp("ready_at", { mode: "date", withTimezone: true }),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
    objectKey: text("object_key"),
    fileName: text("file_name"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    sha256: text("sha256"),
    downloadCount: integer("download_count").notNull().default(0),
    /** Error code the worker reported for a delayed or failed request; never record content. */
    lastErrorCode: text("last_error_code"),
    /** Highest overdue alert already raised: 0 none, 1 after 24 hours, 2 after 7 days, 3 after 21 days. */
    deadlineAlertTier: integer("deadline_alert_tier").notNull().default(0),
    objectPurgeRequestedAt: timestamp("object_purge_requested_at", {
      mode: "date",
      withTimezone: true,
    }),
    objectPurgedAt: timestamp("object_purged_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "subject_data_export_status_valid",
      sql`${table.status} IN ('requested','collecting','delayed','ready','expired','deleted','failed')`,
    ),
    check(
      "subject_data_export_ready_has_file",
      sql`${table.status} <> 'ready' OR (${table.objectKey} IS NOT NULL AND ${table.expiresAt} IS NOT NULL)`,
    ),
    uniqueIndex("subject_data_export_one_open_uidx")
      .on(table.subjectId)
      .where(sql`${table.status} IN ('requested','collecting','delayed','ready')`),
    index("subject_data_export_subject_requested_idx").on(table.subjectId, table.requestedAt),
    index("subject_data_export_expiry_idx")
      .on(table.expiresAt)
      .where(sql`${table.status} = 'ready'`),
    index("subject_data_export_purge_idx")
      .on(table.objectPurgeRequestedAt)
      .where(sql`${table.objectPurgeRequestedAt} IS NOT NULL AND ${table.objectPurgedAt} IS NULL`),
  ],
);

/**
 * Append-only record of what happened to each request: ids, counts, sizes, hashes, addresses and
 * times, never record content. The event names are the audit vocabulary of the design
 * (`data_export.requested`, `.product_collected`, `.delayed`, `.ready`, `.downloaded`,
 * `.expired`, `.deleted_by_subject`, `.failed`).
 */
export const subjectDataExportAudit = pgTable(
  "subject_data_export_audit",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    exportId: uuid("export_id")
      .notNull()
      .references(() => subjectDataExport.id, { onDelete: "cascade" }),
    subjectId: text("subject_id").notNull(),
    event: text("event").notNull(),
    sessionId: text("session_id"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    detail: jsonb("detail").notNull().default(sql`'{}'::jsonb`),
    occurredAt: timestamp("occurred_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("subject_data_export_audit_export_idx").on(table.exportId, table.occurredAt)],
);
