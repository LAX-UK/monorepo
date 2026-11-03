import type { Database } from "@auction/db";
import { kycRetentionTombstone, legalEntityDocument, uploadObject } from "@auction/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import type {
  IKycRetentionSubjectStore,
  PurgeContext,
  RecordCounts,
  RetentionCandidate,
  RetentionHolding,
} from "../interfaces/kyc-retention-subject.store.js";
import { KYC_RETENTION_BASIS } from "../retention/kyc-retention-policy.js";

type CandidateRow = {
  subject_id: string;
  closed_at: Date | string;
  last_activity_at: Date | string | null;
};

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * The verification documents of an organisation or personal account. The relationship closes when
 * the legal entity is archived or rejected. A restricted entity is still a relationship.
 */
export class DrizzleKycRetentionLegalEntityStore implements IKycRetentionSubjectStore {
  readonly kind = "legal_entity" as const;

  constructor(private readonly db: Database) {}

  async listCandidates(input: {
    closedBefore: Date;
    afterId: string | null;
    limit: number;
  }): Promise<RetentionCandidate[]> {
    const result = await this.db.execute<CandidateRow>(sql`
      SELECT
        le."id"::text AS subject_id,
        COALESCE(le."status_changed_at", le."updated_at") AS closed_at,
        GREATEST(
          (SELECT MAX("created_at") FROM "bid" WHERE "buyer_legal_entity_id" = le."id"),
          (SELECT MAX("created_at") FROM "payment" WHERE "buyer_legal_entity_id" = le."id"),
          (SELECT MAX("created_at") FROM "payment" WHERE "seller_legal_entity_id" = le."id"),
          (SELECT MAX(GREATEST("created_at", "processed_at"))
             FROM "payout" WHERE "legal_entity_id" = le."id"),
          (SELECT MAX(GREATEST("uploaded_at", "reviewed_at"))
             FROM "legal_entity_document" WHERE "legal_entity_id" = le."id")
        ) AS last_activity_at
      FROM "legal_entity" le
      WHERE le."status" IN ('archived', 'rejected')
        AND COALESCE(le."status_changed_at", le."updated_at") < ${input.closedBefore}
        AND (${input.afterId}::text IS NULL OR le."id"::text > ${input.afterId})
        AND EXISTS (SELECT 1 FROM "legal_entity_document" d WHERE d."legal_entity_id" = le."id")
      ORDER BY le."id"::text
      LIMIT ${input.limit}
    `);
    return result.rows.map((row) => ({
      subjectId: row.subject_id,
      closedAt: toDate(row.closed_at),
      lastActivityAt: row.last_activity_at ? toDate(row.last_activity_at) : null,
    }));
  }

  async describeHolding(subjectId: string): Promise<RetentionHolding> {
    const documents = await this.db
      .select({ id: legalEntityDocument.id, key: uploadObject.key })
      .from(legalEntityDocument)
      .innerJoin(uploadObject, eq(uploadObject.id, legalEntityDocument.uploadObjectId))
      .where(eq(legalEntityDocument.legalEntityId, subjectId));
    const storageKeys = [...new Set(documents.map((doc) => doc.key))].sort();
    return {
      records:
        documents.length === 0
          ? {}
          : { legal_entity_document: documents.length, upload_object: storageKeys.length },
      storageKeys,
    };
  }

  async erase(subjectId: string, context: PurgeContext): Promise<RecordCounts> {
    return this.db.transaction(async (tx) => {
      const removedDocuments = await tx
        .delete(legalEntityDocument)
        .where(eq(legalEntityDocument.legalEntityId, subjectId))
        .returning({ uploadObjectId: legalEntityDocument.uploadObjectId });
      const objectIds = removedDocuments.map((doc) => doc.uploadObjectId);
      const removedFiles =
        objectIds.length === 0
          ? []
          : await tx
              .delete(uploadObject)
              .where(inArray(uploadObject.id, objectIds))
              .returning({ id: uploadObject.id });

      const counts: RecordCounts = {};
      if (removedDocuments.length > 0) counts.legal_entity_document = removedDocuments.length;
      if (removedFiles.length > 0) counts.upload_object = removedFiles.length;
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
}
