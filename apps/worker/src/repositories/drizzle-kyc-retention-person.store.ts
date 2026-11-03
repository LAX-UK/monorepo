import type { Database } from "@auction/db";
import {
  adminReviewTask,
  kycRetentionTombstone,
  kycVerification,
  kycWatchlistScreening,
  sourceOfFunds,
  sourceOfFundsDocument,
  sourceOfFundsDocumentReview,
  uploadObject,
} from "@auction/db/schema";
import { and, count, eq, inArray, or, sql } from "drizzle-orm";
import type {
  IKycRetentionSubjectStore,
  PurgeContext,
  RecordCounts,
  RetentionCandidate,
  RetentionHolding,
} from "../interfaces/kyc-retention-subject.store.js";
import { KYC_RETENTION_BASIS } from "../retention/kyc-retention-policy.js";

const COMPLIANCE_TASK_KINDS = ["aml_screening_review", "source_of_funds_review"] as const;

type CandidateRow = {
  subject_id: string;
  closed_at: Date | string;
  last_activity_at: Date | string | null;
};

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * A person's KYC verification, AML screening and source-of-funds files. The person closes the
 * relationship by deleting their account, which Identity records as `user.identity_deleted`.
 */
export class DrizzleKycRetentionPersonStore implements IKycRetentionSubjectStore {
  readonly kind = "person" as const;

  constructor(private readonly db: Database) {}

  async listCandidates(input: {
    closedBefore: Date;
    afterId: string | null;
    limit: number;
  }): Promise<RetentionCandidate[]> {
    const result = await this.db.execute<CandidateRow>(sql`
      WITH closed AS (
        SELECT "aggregate_id" AS subject_id, MAX("occurred_at") AS closed_at
        FROM "domain_events"
        WHERE "event_type" = 'user.identity_deleted' AND "aggregate_type" = 'user'
        GROUP BY "aggregate_id"
      )
      SELECT
        closed.subject_id,
        closed.closed_at,
        GREATEST(
          (SELECT MAX("created_at") FROM "bid" WHERE "bidder_id" = closed.subject_id),
          (SELECT MAX("created_at") FROM "bid" WHERE "subject_id" = closed.subject_id),
          (SELECT MAX("created_at") FROM "payment" WHERE "buyer_id" = closed.subject_id),
          (SELECT MAX(GREATEST(p."created_at", p."processed_at"))
             FROM "payout" p
             JOIN "legal_entity" le ON le."id" = p."legal_entity_id"
            WHERE le."created_by_user_id" = closed.subject_id),
          (SELECT MAX(GREATEST("created_at", "decision_at"))
             FROM "kyc_verification" WHERE "user_id" = closed.subject_id),
          (SELECT MAX(GREATEST("created_at", "screened_at", "reviewed_at"))
             FROM "kyc_watchlist_screening" WHERE "user_id" = closed.subject_id),
          (SELECT MAX(GREATEST("created_at", "updated_at", "reviewed_at"))
             FROM "source_of_funds" WHERE "user_id" = closed.subject_id)
        ) AS last_activity_at
      FROM closed
      WHERE closed.closed_at < ${input.closedBefore}
        AND (${input.afterId}::text IS NULL OR closed.subject_id > ${input.afterId})
        AND (
          EXISTS (SELECT 1 FROM "kyc_verification" WHERE "user_id" = closed.subject_id)
          OR EXISTS (SELECT 1 FROM "kyc_watchlist_screening" WHERE "user_id" = closed.subject_id)
          OR EXISTS (SELECT 1 FROM "source_of_funds" WHERE "user_id" = closed.subject_id)
          OR EXISTS (
            SELECT 1 FROM "admin_review_task"
            WHERE "kind" IN ('aml_screening_review', 'source_of_funds_review')
              AND "payload" ->> 'userId' = closed.subject_id
          )
        )
      ORDER BY closed.subject_id
      LIMIT ${input.limit}
    `);
    return result.rows.map((row) => ({
      subjectId: row.subject_id,
      closedAt: toDate(row.closed_at),
      lastActivityAt: row.last_activity_at ? toDate(row.last_activity_at) : null,
    }));
  }

  async describeHolding(subjectId: string): Promise<RetentionHolding> {
    const cases = await this.caseIds(this.db, subjectId);
    const documents = await this.documents(this.db, cases);
    const storageKeys = await this.storageKeys(this.db, subjectId, documents);
    const [verifications, screenings, tasks, reviews] = await Promise.all([
      this.db
        .select({ n: count() })
        .from(kycVerification)
        .where(eq(kycVerification.userId, subjectId))
        .then(firstCount),
      this.db
        .select({ n: count() })
        .from(kycWatchlistScreening)
        .where(eq(kycWatchlistScreening.userId, subjectId))
        .then(firstCount),
      this.db
        .select({ n: count() })
        .from(adminReviewTask)
        .where(this.taskFilter(subjectId))
        .then(firstCount),
      cases.length === 0
        ? 0
        : this.db
            .select({ n: count() })
            .from(sourceOfFundsDocumentReview)
            .where(inArray(sourceOfFundsDocumentReview.sourceOfFundsId, cases))
            .then(firstCount),
    ]);
    return {
      records: nonZero({
        kyc_verification: verifications,
        aml_screening: screenings,
        source_of_funds_case: cases.length,
        source_of_funds_document: documents.length,
        source_of_funds_document_review: reviews,
        compliance_review_task: tasks,
        upload_object: storageKeys.length,
      }),
      storageKeys,
    };
  }

  async erase(subjectId: string, context: PurgeContext): Promise<RecordCounts> {
    return this.db.transaction(async (tx) => {
      const cases = await this.caseIds(tx, subjectId);
      const documents = await this.documents(tx, cases);
      const keys = await this.storageKeys(tx, subjectId, documents);

      const reviews =
        cases.length === 0
          ? []
          : await tx
              .delete(sourceOfFundsDocumentReview)
              .where(inArray(sourceOfFundsDocumentReview.sourceOfFundsId, cases))
              .returning({ id: sourceOfFundsDocumentReview.documentId });
      const removedDocuments =
        cases.length === 0
          ? []
          : await tx
              .delete(sourceOfFundsDocument)
              .where(inArray(sourceOfFundsDocument.sourceOfFundsId, cases))
              .returning({ id: sourceOfFundsDocument.id });
      const removedFiles =
        keys.length === 0
          ? []
          : await tx
              .delete(uploadObject)
              .where(inArray(uploadObject.key, keys))
              .returning({ id: uploadObject.id });
      const removedCases =
        cases.length === 0
          ? []
          : await tx
              .delete(sourceOfFunds)
              .where(inArray(sourceOfFunds.id, cases))
              .returning({ id: sourceOfFunds.id });
      const screenings = await tx
        .delete(kycWatchlistScreening)
        .where(eq(kycWatchlistScreening.userId, subjectId))
        .returning({ id: kycWatchlistScreening.id });
      const verifications = await tx
        .delete(kycVerification)
        .where(eq(kycVerification.userId, subjectId))
        .returning({ id: kycVerification.id });
      const tasks = await tx
        .delete(adminReviewTask)
        .where(this.taskFilter(subjectId))
        .returning({ id: adminReviewTask.id });

      const counts = nonZero({
        kyc_verification: verifications.length,
        aml_screening: screenings.length,
        source_of_funds_case: removedCases.length,
        source_of_funds_document: removedDocuments.length,
        source_of_funds_document_review: reviews.length,
        compliance_review_task: tasks.length,
        upload_object: removedFiles.length,
      });
      const tombstones = Object.entries(counts).map(([recordKind, recordsPurged]) => ({
        subjectKind: this.kind,
        subjectId,
        recordKind,
        recordsPurged,
        relationshipEndedAt: context.relationshipEndedAt,
        retentionBasis: KYC_RETENTION_BASIS,
        purgedAt: context.purgedAt,
      }));
      if (tombstones.length > 0) await tx.insert(kycRetentionTombstone).values(tombstones);
      return counts;
    });
  }

  private taskFilter(subjectId: string) {
    return and(
      inArray(adminReviewTask.kind, [...COMPLIANCE_TASK_KINDS]),
      sql`${adminReviewTask.payload} ->> 'userId' = ${subjectId}`,
    );
  }

  private async caseIds(db: Pick<Database, "select">, subjectId: string): Promise<string[]> {
    const rows = await db
      .select({ id: sourceOfFunds.id })
      .from(sourceOfFunds)
      .where(eq(sourceOfFunds.userId, subjectId));
    return rows.map((row) => row.id);
  }

  private async documents(
    db: Pick<Database, "select">,
    caseIds: string[],
  ): Promise<{ id: string; uploadObjectId: string }[]> {
    if (caseIds.length === 0) return [];
    return db
      .select({
        id: sourceOfFundsDocument.id,
        uploadObjectId: sourceOfFundsDocument.uploadObjectId,
      })
      .from(sourceOfFundsDocument)
      .where(inArray(sourceOfFundsDocument.sourceOfFundsId, caseIds));
  }

  /** Keys of the uploaded files: those the documents point at and those listed as case evidence. */
  private async storageKeys(
    db: Pick<Database, "select">,
    subjectId: string,
    documents: { uploadObjectId: string }[],
  ): Promise<string[]> {
    const evidence = await db
      .select({ evidence: sourceOfFunds.evidence })
      .from(sourceOfFunds)
      .where(eq(sourceOfFunds.userId, subjectId));
    const listed = evidence.flatMap((row) => row.evidence);
    const documentObjectIds = documents.map((doc) => doc.uploadObjectId);
    if (listed.length === 0 && documentObjectIds.length === 0) return [];
    const rows = await db
      .select({ key: uploadObject.key })
      .from(uploadObject)
      .where(
        or(
          documentObjectIds.length > 0 ? inArray(uploadObject.id, documentObjectIds) : undefined,
          listed.length > 0 ? inArray(uploadObject.key, listed) : undefined,
        ),
      );
    return [...new Set(rows.map((row) => row.key))].sort();
  }
}

function firstCount(rows: { n: number }[]): number {
  return Number(rows[0]?.n ?? 0);
}

function nonZero(counts: RecordCounts): RecordCounts {
  return Object.fromEntries(Object.entries(counts).filter(([, n]) => (n ?? 0) > 0));
}
