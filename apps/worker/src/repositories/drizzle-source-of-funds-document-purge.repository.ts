import type { Database } from "@auction/db";
import {
  sourceOfFunds,
  sourceOfFundsDocument,
  sourceOfFundsDocumentReview,
  uploadObject,
} from "@auction/db/schema";
import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import type { ISourceOfFundsDocumentPurgeRepository } from "../interfaces/source-of-funds-document-purge.repository.js";

export class DrizzleSourceOfFundsDocumentPurgeRepository
  implements ISourceOfFundsDocumentPurgeRepository
{
  constructor(private readonly db: Database) {}

  async findTerminalCasesPastRetention(cutoff: Date, limit: number) {
    return this.db
      .select({ id: sourceOfFunds.id, reviewedAt: sourceOfFunds.reviewedAt })
      .from(sourceOfFunds)
      .where(
        and(
          or(eq(sourceOfFunds.status, "approved"), eq(sourceOfFunds.status, "rejected")),
          lt(sourceOfFunds.reviewedAt, cutoff),
        ),
      )
      .limit(limit);
  }

  async findDocumentsToPurge(caseIds: string[], limit: number) {
    return this.db
      .select({
        id: sourceOfFundsDocument.id,
        uploadObjectId: sourceOfFundsDocument.uploadObjectId,
        key: uploadObject.key,
      })
      .from(sourceOfFundsDocument)
      .innerJoin(uploadObject, eq(uploadObject.id, sourceOfFundsDocument.uploadObjectId))
      .where(
        and(
          inArray(sourceOfFundsDocument.sourceOfFundsId, caseIds),
          isNull(sourceOfFundsDocument.anonymizedAt),
        ),
      )
      .limit(limit);
  }

  async anonymizeDocument(docId: string, now: Date): Promise<void> {
    await this.db
      .update(sourceOfFundsDocument)
      .set({
        anonymizedAt: now,
        label: null,
        reviewStatus: "superseded",
      })
      .where(eq(sourceOfFundsDocument.id, docId));
  }

  async deleteDocumentReviews(docId: string): Promise<void> {
    await this.db
      .delete(sourceOfFundsDocumentReview)
      .where(eq(sourceOfFundsDocumentReview.documentId, docId));
  }
}
