import type { Database } from "@auction/db";
import { sourceOfFundsDocumentReview } from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";

export type SourceOfFundsDocumentChecks = {
  matchesDeclaredSource?: boolean;
  coversExposure?: boolean;
  recentEnough?: boolean;
  legibleComplete?: boolean;
};

export type SourceOfFundsDocumentReviewRow = {
  documentId: string;
  sourceOfFundsId: string;
  reviewedByUserId: string;
  reviewedAt: Date;
  checks: SourceOfFundsDocumentChecks;
  note: string | null;
};

export interface ISourceOfFundsDocumentReviewRepository {
  upsertLatest(
    input: {
      documentId: string;
      sourceOfFundsId: string;
      reviewedByUserId: string;
      reviewedAt: Date;
      checks: SourceOfFundsDocumentChecks;
      note: string | null;
    },
    conn?: Database,
  ): Promise<SourceOfFundsDocumentReviewRow>;
  listForCase(sourceOfFundsId: string, conn?: Database): Promise<SourceOfFundsDocumentReviewRow[]>;
  deleteForDocument(documentId: string, conn?: Database): Promise<void>;
  deleteForDocuments(documentIds: readonly string[], conn?: Database): Promise<void>;
}

function rowToReview(
  row: typeof sourceOfFundsDocumentReview.$inferSelect,
): SourceOfFundsDocumentReviewRow {
  const checks =
    row.checks && typeof row.checks === "object" && !Array.isArray(row.checks)
      ? (row.checks as SourceOfFundsDocumentChecks)
      : {};
  return {
    documentId: row.documentId,
    sourceOfFundsId: row.sourceOfFundsId,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt,
    checks,
    note: row.note ?? null,
  };
}

export class DrizzleSourceOfFundsDocumentReviewRepository
  implements ISourceOfFundsDocumentReviewRepository
{
  constructor(private readonly db: Database) {}

  private conn(c?: Database): Database {
    return c ?? this.db;
  }

  async upsertLatest(
    input: {
      documentId: string;
      sourceOfFundsId: string;
      reviewedByUserId: string;
      reviewedAt: Date;
      checks: SourceOfFundsDocumentChecks;
      note: string | null;
    },
    conn?: Database,
  ): Promise<SourceOfFundsDocumentReviewRow> {
    const [row] = await this.conn(conn)
      .insert(sourceOfFundsDocumentReview)
      .values({
        documentId: input.documentId,
        sourceOfFundsId: input.sourceOfFundsId,
        reviewedByUserId: input.reviewedByUserId,
        reviewedAt: input.reviewedAt,
        checks: input.checks,
        note: input.note,
      })
      .onConflictDoUpdate({
        target: sourceOfFundsDocumentReview.documentId,
        set: {
          reviewedByUserId: input.reviewedByUserId,
          reviewedAt: input.reviewedAt,
          checks: input.checks,
          note: input.note,
        },
      })
      .returning();
    if (!row) throw new Error("source_of_funds_document_review_upsert_failed");
    return rowToReview(row);
  }

  async listForCase(
    sourceOfFundsId: string,
    conn?: Database,
  ): Promise<SourceOfFundsDocumentReviewRow[]> {
    const rows = await this.conn(conn)
      .select()
      .from(sourceOfFundsDocumentReview)
      .where(eq(sourceOfFundsDocumentReview.sourceOfFundsId, sourceOfFundsId));
    return rows.map(rowToReview);
  }

  async deleteForDocument(documentId: string, conn?: Database): Promise<void> {
    await this.conn(conn)
      .delete(sourceOfFundsDocumentReview)
      .where(eq(sourceOfFundsDocumentReview.documentId, documentId));
  }

  async deleteForDocuments(documentIds: readonly string[], conn?: Database): Promise<void> {
    if (documentIds.length === 0) return;
    await this.conn(conn)
      .delete(sourceOfFundsDocumentReview)
      .where(inArray(sourceOfFundsDocumentReview.documentId, [...documentIds]));
  }
}
