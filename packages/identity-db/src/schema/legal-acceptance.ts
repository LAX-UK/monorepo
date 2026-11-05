import { sql } from "drizzle-orm";
import { check, date, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

/**
 * Which Terms and Privacy notice a person accepted when they created their LAX Account: one row
 * per document and version, written with the account and never edited. A later version the person
 * accepts is a new row.
 *
 * `legal_entity` and `product` name whose documents the sign-up page linked (London Auction Xchange
 * LTD for LAX Bid and LAX Account, London Art Exchange Ltd for LAX Shop and lax.art). The row holds
 * no name or contact detail, so it is kept when the account is erased; the erasure scrub leaves
 * the user row in place and the foreign key stops it being removed while a record exists.
 */
export const subjectLegalAcceptance = pgTable(
  "subject_legal_acceptance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: text("subject_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    documentKind: text("document_kind").notNull(),
    documentVersion: text("document_version").notNull(),
    /** London calendar date from which the accepted wording applied. */
    documentEffectiveOn: date("document_effective_on", { mode: "string" }).notNull(),
    legalEntity: text("legal_entity").notNull(),
    product: text("product").notNull(),
    source: text("source").notNull(),
    acceptedAt: timestamp("accepted_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("subject_legal_acceptance_document_uidx").on(
      table.subjectId,
      table.legalEntity,
      table.documentKind,
      table.documentVersion,
    ),
    check("subject_legal_acceptance_kind_valid", sql`${table.documentKind} IN ('terms','privacy')`),
    check(
      "subject_legal_acceptance_entity_valid",
      sql`${table.legalEntity} IN ('london-auction-xchange','london-art-exchange')`,
    ),
    check(
      "subject_legal_acceptance_product_valid",
      sql`${table.product} IN ('account','bid','shop','art')`,
    ),
    check(
      "subject_legal_acceptance_source_valid",
      sql`${table.source} IN ('hosted_sign_up','social_sign_up')`,
    ),
    check("subject_legal_acceptance_version_present", sql`length(${table.documentVersion}) > 0`),
  ],
);

export type SubjectLegalAcceptanceRow = typeof subjectLegalAcceptance.$inferSelect;
