import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Proof that a person's or organisation's KYC, AML or source-of-funds records were purged at the end
 * of their retention period. It holds an opaque id, a record kind, counts and dates, and no
 * personal data. Append-only: the purge job inserts and never changes or removes a row.
 */
export const kycRetentionTombstone = pgTable(
  "kyc_retention_tombstone",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** `person` (a user id) or `legal_entity`. */
    subjectKind: text("subject_kind").notNull(),
    subjectId: text("subject_id").notNull(),
    /** What was purged, for example `kyc_verification` or `upload_object` (a stored file and its row). */
    recordKind: text("record_kind").notNull(),
    recordsPurged: integer("records_purged").notNull(),
    /** When the business relationship ended, by the rule recorded in `retentionBasis`. */
    relationshipEndedAt: timestamp("relationship_ended_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    retentionBasis: text("retention_basis").notNull(),
    purgedAt: timestamp("purged_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [index("kyc_retention_tombstone_subject_idx").on(table.subjectKind, table.subjectId)],
);
