/**
 * How long the KYC, AML and source-of-funds records of LAX Bid are kept, and what that covers.
 *
 * UK Money Laundering Regulations 2017, regulation 40: customer due diligence records and the
 * supporting evidence are kept for five years from the end of the business relationship, then
 * deleted. This file is the single list of what is covered and the one rule for when it is due.
 *
 * The end of the relationship is read from data that exists, and is the later of two dates:
 * - Closure. A person closes the relationship by deleting their account (the Identity event
 *   `user.identity_deleted`). An organisation closes it when it is archived or rejected.
 *   Restricted is not closure: a restriction is a control measure and the relationship goes on.
 *   An account that is neither deleted nor closed is never due, however long it has been quiet.
 * - Last activity. The latest bid, payment or payout of the subject, and the latest change to the
 *   records themselves. A transaction after closure (a late refund, a payout) moves the end later.
 * Taking the later date means nothing is purged early.
 */

export const KYC_RETENTION_YEARS = 5;

/** Written to every tombstone so the basis of a purge can be read back later. */
export const KYC_RETENTION_BASIS = "mlr2017_reg40_5y_after_relationship_end";

export type RetentionSubjectKind = "person" | "legal_entity";

export type KycRecordKind =
  | "kyc_verification"
  | "aml_screening"
  | "source_of_funds_case"
  | "source_of_funds_document"
  | "source_of_funds_document_review"
  | "compliance_review_task"
  | "legal_entity_document"
  | "upload_object";

export type RetentionInventoryEntry = {
  subjectKind: RetentionSubjectKind;
  recordKind: KycRecordKind;
  table: string;
  /** Why the rows are personal data or evidence that the retention period covers. */
  holds: string;
  /** True when the rows point at a file in object storage that is deleted with them. */
  hasStoredFile: boolean;
};

/** Every table the purge deletes from. The repositories and their tests follow this list. */
export const KYC_RETENTION_INVENTORY: readonly RetentionInventoryEntry[] = [
  {
    subjectKind: "person",
    recordKind: "kyc_verification",
    table: "kyc_verification",
    holds: "identity check result: name, date of birth, document details, provider payload",
    hasStoredFile: false,
  },
  {
    subjectKind: "person",
    recordKind: "aml_screening",
    table: "kyc_watchlist_screening",
    holds: "sanctions, PEP and adverse-media screening result and analyst notes",
    hasStoredFile: false,
  },
  {
    subjectKind: "person",
    recordKind: "source_of_funds_case",
    table: "source_of_funds",
    holds: "declared source of funds, exposure, reviewer decisions and notes",
    hasStoredFile: false,
  },
  {
    subjectKind: "person",
    recordKind: "source_of_funds_document",
    table: "source_of_funds_document",
    holds: "evidence the buyer uploaded for a case",
    hasStoredFile: true,
  },
  {
    subjectKind: "person",
    recordKind: "source_of_funds_document_review",
    table: "source_of_funds_document_review",
    holds: "staff checklist and note for an evidence file",
    hasStoredFile: false,
  },
  {
    subjectKind: "person",
    recordKind: "compliance_review_task",
    table: "admin_review_task",
    holds: "AML screening and source-of-funds work items, with screening reasons in the payload",
    hasStoredFile: false,
  },
  {
    subjectKind: "legal_entity",
    recordKind: "legal_entity_document",
    table: "legal_entity_document",
    holds: "organisation or personal verification documents and reviewer notes",
    hasStoredFile: true,
  },
  {
    subjectKind: "person",
    recordKind: "upload_object",
    table: "upload_object",
    holds: "the stored file behind a source-of-funds document",
    hasStoredFile: true,
  },
  {
    subjectKind: "legal_entity",
    recordKind: "upload_object",
    table: "upload_object",
    holds: "the stored file behind a legal entity document",
    hasStoredFile: true,
  },
];

export type RelationshipDates = {
  /** When the subject closed the relationship. */
  closedAt: Date;
  /** The latest bid, payment, payout or record change, if any. */
  lastActivityAt: Date | null;
};

/** The later of closure and last activity. */
export function relationshipEndedAt({ closedAt, lastActivityAt }: RelationshipDates): Date {
  return lastActivityAt && lastActivityAt > closedAt ? lastActivityAt : closedAt;
}

/** Five calendar years after the relationship ended. */
export function retentionEndsAt(relationshipEnded: Date): Date {
  const ends = new Date(relationshipEnded);
  ends.setUTCFullYear(ends.getUTCFullYear() + KYC_RETENTION_YEARS);
  return ends;
}

/** Due only once the five years have fully passed; the last day itself is still inside. */
export function isRetentionExpired(relationshipEnded: Date, now: Date): boolean {
  return now > retentionEndsAt(relationshipEnded);
}

/**
 * The latest closure date that can possibly be due, used to narrow the candidate query. The real
 * end is never earlier than closure, so any subject closed after this date cannot be due.
 */
export function latestClosureThatCanBeDue(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - KYC_RETENTION_YEARS);
  return cutoff;
}
