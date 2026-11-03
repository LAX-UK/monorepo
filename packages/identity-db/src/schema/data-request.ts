import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { subjectDataExport } from "./subject-export.js";

/** Numbers manual requests: DR-0001 upwards. */
export const subjectDataRequestReferenceSeq = pgSequence("subject_data_request_reference_seq");

/**
 * A request for a copy of someone's data that staff log and answer by hand: a full copy with
 * staff notes and outside systems, a request after the account was deleted, or an automatic
 * download that failed and was continued manually.
 *
 * Dates are London calendar dates, not moments. `clock_started_on` and `due_on` stay null while
 * the request waits for proof of identity. `subject_id` is nulled if the user row is ever
 * deleted so the proof that a request was answered survives; the contact fields are cleared by
 * the retention job some time after the request closes, the rest is kept.
 */
export const subjectDataRequest = pgTable(
  "subject_data_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference")
      .notNull()
      .unique()
      .default(sql`'DR-' || lpad(nextval('subject_data_request_reference_seq')::text, 4, '0')`),
    subjectId: text("subject_id").references(() => user.id, { onDelete: "set null" }),
    contactName: text("contact_name"),
    contactDetail: text("contact_detail"),
    /** Set when retention cleared the contact fields. */
    contactClearedAt: timestamp("contact_cleared_at", { mode: "date", withTimezone: true }),
    reason: text("reason").notNull(),
    channel: text("channel").notNull(),
    products: text("products").array().notNull(),
    /** `{ account|bid|shop: { at, by } }`, the products staff have ticked off. */
    productGathered: jsonb("product_gathered").notNull().default(sql`'{}'::jsonb`),
    receivedOn: date("received_on", { mode: "string" }).notNull(),
    clockStartedOn: date("clock_started_on", { mode: "string" }),
    dueOn: date("due_on", { mode: "string" }),
    extendedDueOn: date("extended_due_on", { mode: "string" }),
    extensionReason: text("extension_reason"),
    extensionNote: text("extension_note"),
    personToldOn: date("person_told_on", { mode: "string" }),
    personToldVia: text("person_told_via"),
    status: text("status").notNull(),
    outcome: text("outcome"),
    outcomeNote: text("outcome_note"),
    /** For a refusal: the person was told they may complain to the ICO. */
    complaintRightTold: boolean("complaint_right_told"),
    closedOn: date("closed_on", { mode: "string" }),
    closedBy: text("closed_by"),
    /** The automatic download this request continues. One download is continued once. */
    linkedExportId: uuid("linked_export_id").references(() => subjectDataExport.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    /** Optimistic concurrency: an edit made against an older version answers 409. */
    version: integer("version").notNull().default(1),
  },
  (table) => [
    check(
      "subject_data_request_reason_valid",
      sql`${table.reason} IN ('full_copy','after_deletion','guest_orders','other')`,
    ),
    check(
      "subject_data_request_channel_valid",
      sql`${table.channel} IN ('support_form','email','post','phone','in_person','other')`,
    ),
    check(
      "subject_data_request_products_valid",
      sql`cardinality(${table.products}) >= 1 AND ${table.products} <@ ARRAY['account','bid','shop']::text[]`,
    ),
    check(
      "subject_data_request_status_valid",
      sql`${table.status} IN ('waiting_for_id','in_progress','closed')`,
    ),
    check(
      "subject_data_request_clock_matches_status",
      sql`(${table.status} <> 'waiting_for_id' OR ${table.dueOn} IS NULL)
        AND (${table.status} <> 'in_progress' OR ${table.dueOn} IS NOT NULL)
        AND (${table.dueOn} IS NULL) = (${table.clockStartedOn} IS NULL)`,
    ),
    check(
      "subject_data_request_extension_whole",
      sql`(${table.extendedDueOn} IS NULL) = (${table.extensionReason} IS NULL)
        AND (${table.extendedDueOn} IS NULL) = (${table.extensionNote} IS NULL)
        AND (${table.extendedDueOn} IS NULL) = (${table.personToldOn} IS NULL)
        AND (${table.extendedDueOn} IS NULL) = (${table.personToldVia} IS NULL)`,
    ),
    check(
      "subject_data_request_extension_limits",
      sql`${table.extendedDueOn} IS NULL OR (
        ${table.dueOn} IS NOT NULL
        AND ${table.extendedDueOn} > ${table.dueOn}
        AND ${table.extendedDueOn} <= (${table.dueOn} + interval '2 months')::date
        AND ${table.personToldOn} <= ${table.dueOn}
      )`,
    ),
    check(
      "subject_data_request_outcome_valid",
      sql`${table.outcome} IS NULL OR ${table.outcome} IN ('sent','sent_partial','nothing_held','refused','withdrawn')`,
    ),
    check(
      "subject_data_request_closed_has_outcome",
      sql`(${table.status} = 'closed') = (${table.outcome} IS NOT NULL)
        AND (${table.status} = 'closed') = (${table.closedOn} IS NOT NULL)
        AND (${table.status} = 'closed') = (${table.closedBy} IS NOT NULL)`,
    ),
    check(
      "subject_data_request_outcome_notes",
      sql`(${table.outcome} IS DISTINCT FROM 'sent_partial' OR ${table.outcomeNote} IS NOT NULL)
        AND (${table.outcome} IS DISTINCT FROM 'refused'
          OR (${table.outcomeNote} IS NOT NULL AND ${table.complaintRightTold} IS TRUE))`,
    ),
    index("subject_data_request_open_due_idx").on(
      table.status,
      sql`coalesce(${table.extendedDueOn}, ${table.dueOn})`,
    ),
    index("subject_data_request_subject_idx").on(table.subjectId),
    uniqueIndex("subject_data_request_linked_export_uidx").on(table.linkedExportId),
    index("subject_data_request_retention_idx")
      .on(table.closedOn)
      .where(sql`${table.contactClearedAt} IS NULL AND ${table.status} = 'closed'`),
  ],
);

/**
 * Append-only record of what staff did to each manual request: ids, dates and codes, never the
 * notes or the person's contact details. The actor is plain text, with no foreign key, so the
 * record outlives the staff account.
 */
export const subjectDataRequestAudit = pgTable(
  "subject_data_request_audit",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => subjectDataRequest.id, { onDelete: "cascade" }),
    actorSubjectId: text("actor_subject_id"),
    event: text("event").notNull(),
    detail: jsonb("detail").notNull().default(sql`'{}'::jsonb`),
    occurredAt: timestamp("occurred_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("subject_data_request_audit_request_idx").on(table.requestId, table.occurredAt),
  ],
);
