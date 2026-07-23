import type { Database } from "@auction/db";
import { payment, sourceOfFunds } from "@auction/db/schema";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { ACTIVE_BUYER_SETTLEMENT_PAYMENT_STATUSES } from "../interfaces/source-of-funds-settlement.types.js";
import type {
  CreateSourceOfFundsCaseInput,
  ISourceOfFundsRepository,
  SourceOfFundsCase,
  SourceOfFundsReviewInput,
  SourceOfFundsStatus,
  SourceOfFundsTriageInput,
  SourceOfFundsTriageRecommendation,
} from "../interfaces/source-of-funds.repository.js";

function rowToCase(row: typeof sourceOfFunds.$inferSelect): SourceOfFundsCase {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status,
    trigger: row.trigger,
    thresholdAmount: row.thresholdAmount,
    exposureAmount: row.exposureAmount,
    currency: row.currency,
    declaredSource: row.declaredSource ?? null,
    evidence: (row.evidence ?? []) as string[],
    documentsRequestedAt: row.documentsRequestedAt ?? null,
    documentsRequestedByUserId: row.documentsRequestedByUserId ?? null,
    documentRequestNote: row.documentRequestNote ?? null,
    requestedDocumentTypes: (row.requestedDocumentTypes ?? []) as string[],
    documentsSubmittedAt: row.documentsSubmittedAt ?? null,
    triageRecommendation:
      (row.triageRecommendation as SourceOfFundsTriageRecommendation | null) ?? null,
    triagedByUserId: row.triagedByUserId ?? null,
    triagedAt: row.triagedAt ?? null,
    triageNotes: row.triageNotes ?? null,
    reviewedByUserId: row.reviewedByUserId ?? null,
    reviewedAt: row.reviewedAt ?? null,
    reviewNotes: row.reviewNotes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleSourceOfFundsRepository implements ISourceOfFundsRepository {
  constructor(private readonly db: Database) {}

  private conn(conn?: Database): Database {
    return conn ?? this.db;
  }

  async findLatestForUser(userId: string, conn?: Database): Promise<SourceOfFundsCase | null> {
    const rows = await this.conn(conn)
      .select()
      .from(sourceOfFunds)
      .where(eq(sourceOfFunds.userId, userId))
      .orderBy(desc(sourceOfFunds.createdAt))
      .limit(1);
    return rows[0] ? rowToCase(rows[0]) : null;
  }

  async findById(id: string, conn?: Database): Promise<SourceOfFundsCase | null> {
    const rows = await this.conn(conn)
      .select()
      .from(sourceOfFunds)
      .where(eq(sourceOfFunds.id, id))
      .limit(1);
    return rows[0] ? rowToCase(rows[0]) : null;
  }

  async findLatestApprovedForUser(
    userId: string,
    conn?: Database,
  ): Promise<SourceOfFundsCase | null> {
    const rows = await this.conn(conn)
      .select()
      .from(sourceOfFunds)
      .where(and(eq(sourceOfFunds.userId, userId), eq(sourceOfFunds.status, "approved")))
      .orderBy(desc(sourceOfFunds.reviewedAt))
      .limit(1);
    return rows[0] ? rowToCase(rows[0]) : null;
  }

  async findPendingForUser(userId: string, conn?: Database): Promise<SourceOfFundsCase | null> {
    const rows = await this.conn(conn)
      .select()
      .from(sourceOfFunds)
      .where(and(eq(sourceOfFunds.userId, userId), eq(sourceOfFunds.status, "pending")))
      .orderBy(asc(sourceOfFunds.createdAt))
      .limit(1);
    return rows[0] ? rowToCase(rows[0]) : null;
  }

  async listByStatus(
    status: SourceOfFundsStatus,
    limit: number,
    offset = 0,
    conn?: Database,
  ): Promise<SourceOfFundsCase[]> {
    const cap = Math.min(200, Math.max(1, limit));
    const skip = Math.max(0, offset);
    const rows = await this.conn(conn)
      .select()
      .from(sourceOfFunds)
      .where(eq(sourceOfFunds.status, status))
      .orderBy(desc(sourceOfFunds.createdAt))
      .limit(cap)
      .offset(skip);
    return rows.map(rowToCase);
  }

  async countByStatus(status: SourceOfFundsStatus, conn?: Database): Promise<number> {
    const [row] = await this.conn(conn)
      .select({ n: sql<number>`count(*)::int` })
      .from(sourceOfFunds)
      .where(eq(sourceOfFunds.status, status));
    return row?.n ?? 0;
  }

  async summarizeByStatus(
    status: SourceOfFundsStatus,
    conn?: Database,
  ): Promise<import("../interfaces/source-of-funds.repository.js").AdminSourceOfFundsListSummary> {
    const [row] = await this.conn(conn)
      .select({
        total: sql<number>`count(*)::int`,
        awaitingTriage: sql<number>`count(*) filter (where ${sourceOfFunds.triageRecommendation} is null)::int`,
        triaged: sql<number>`count(*) filter (where ${sourceOfFunds.triageRecommendation} is not null)::int`,
      })
      .from(sourceOfFunds)
      .where(eq(sourceOfFunds.status, status));

    return {
      total: row?.total ?? 0,
      awaitingTriage: row?.awaitingTriage ?? 0,
      triaged: row?.triaged ?? 0,
    };
  }

  async create(input: CreateSourceOfFundsCaseInput, conn?: Database): Promise<SourceOfFundsCase> {
    const [row] = await this.conn(conn)
      .insert(sourceOfFunds)
      .values({
        userId: input.userId,
        trigger: input.trigger,
        thresholdAmount: input.thresholdAmount,
        exposureAmount: input.exposureAmount,
        currency: input.currency,
      })
      .returning();
    if (!row) throw new Error("source_of_funds_create_failed");
    return rowToCase(row);
  }

  async setTriage(
    input: SourceOfFundsTriageInput,
    conn?: Database,
  ): Promise<SourceOfFundsCase | null> {
    const [row] = await this.conn(conn)
      .update(sourceOfFunds)
      .set({
        triageRecommendation: input.recommendation,
        triagedByUserId: input.triagedByUserId,
        triagedAt: new Date(),
        triageNotes: input.triageNotes,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sourceOfFunds.id, input.id),
          eq(sourceOfFunds.status, "pending"),
          sql`${sourceOfFunds.triageRecommendation} IS NULL`,
        ),
      )
      .returning();
    return row ? rowToCase(row) : null;
  }

  async setReview(
    input: SourceOfFundsReviewInput,
    conn?: Database,
  ): Promise<SourceOfFundsCase | null> {
    const [row] = await this.conn(conn)
      .update(sourceOfFunds)
      .set({
        status: input.status,
        reviewedByUserId: input.reviewedByUserId,
        reviewedAt: new Date(),
        reviewNotes: input.reviewNotes,
        updatedAt: new Date(),
      })
      .where(and(eq(sourceOfFunds.id, input.id), eq(sourceOfFunds.status, "pending")))
      .returning();
    return row ? rowToCase(row) : null;
  }

  async reopenRejected(id: string, conn?: Database): Promise<SourceOfFundsCase | null> {
    const [row] = await this.conn(conn)
      .update(sourceOfFunds)
      .set({
        status: "pending",
        triageRecommendation: null,
        triagedByUserId: null,
        triagedAt: null,
        triageNotes: null,
        reviewedByUserId: null,
        reviewedAt: null,
        reviewNotes: null,
        documentsRequestedAt: null,
        documentsRequestedByUserId: null,
        documentRequestNote: null,
        requestedDocumentTypes: [],
        documentsSubmittedAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(sourceOfFunds.id, id), eq(sourceOfFunds.status, "rejected")))
      .returning();
    return row ? rowToCase(row) : null;
  }

  async setDocumentRequest(
    input: {
      id: string;
      requestedByUserId: string;
      documentTypes: string[];
      note: string | null;
    },
    conn?: Database,
  ): Promise<SourceOfFundsCase | null> {
    const [row] = await this.conn(conn)
      .update(sourceOfFunds)
      .set({
        documentsRequestedAt: new Date(),
        documentsRequestedByUserId: input.requestedByUserId,
        documentRequestNote: input.note,
        requestedDocumentTypes: input.documentTypes,
        documentsSubmittedAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(sourceOfFunds.id, input.id), eq(sourceOfFunds.status, "pending")))
      .returning();
    return row ? rowToCase(row) : null;
  }

  async setDocumentsSubmitted(id: string, conn?: Database): Promise<SourceOfFundsCase | null> {
    const [row] = await this.conn(conn)
      .update(sourceOfFunds)
      .set({
        documentsSubmittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sourceOfFunds.id, id),
          eq(sourceOfFunds.status, "pending"),
          sql`${sourceOfFunds.documentsRequestedAt} IS NOT NULL`,
          sql`${sourceOfFunds.documentsSubmittedAt} IS NULL`,
        ),
      )
      .returning();
    return row ? rowToCase(row) : null;
  }

  async resetDocumentCycle(id: string, conn?: Database): Promise<void> {
    await this.conn(conn)
      .update(sourceOfFunds)
      .set({
        documentsRequestedAt: null,
        documentsRequestedByUserId: null,
        documentRequestNote: null,
        requestedDocumentTypes: [],
        documentsSubmittedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(sourceOfFunds.id, id));
  }

  async sumActiveBuyerSettlementPence(
    userId: string,
    excludePaymentId?: string,
    conn?: Database,
  ): Promise<number> {
    const conditions = [
      eq(payment.buyerId, userId),
      inArray(payment.status, [...ACTIVE_BUYER_SETTLEMENT_PAYMENT_STATUSES]),
    ];
    if (excludePaymentId) {
      conditions.push(ne(payment.id, excludePaymentId));
    }
    const [row] = await this.conn(conn)
      .select({
        // Aggregate GBP major-unit amounts into pence (platform is GBP-only).
        totalPence: sql<number>`COALESCE(ROUND(SUM(${payment.amount}) * 100), 0)::bigint`,
      })
      .from(payment)
      .where(and(...conditions));
    return Number(row?.totalPence ?? 0);
  }

  async listForUser(userId: string, limit: number, conn?: Database): Promise<SourceOfFundsCase[]> {
    const rows = await this.conn(conn)
      .select()
      .from(sourceOfFunds)
      .where(eq(sourceOfFunds.userId, userId))
      .orderBy(desc(sourceOfFunds.createdAt))
      .limit(limit);
    return rows.map(rowToCase);
  }

  async countPendingByUserIds(
    userIds: readonly string[],
    conn?: Database,
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) return out;

    const rows = await this.conn(conn)
      .select({
        userId: sourceOfFunds.userId,
        n: sql<number>`count(*)::int`,
      })
      .from(sourceOfFunds)
      .where(and(inArray(sourceOfFunds.userId, uniqueIds), eq(sourceOfFunds.status, "pending")))
      .groupBy(sourceOfFunds.userId);

    for (const row of rows) {
      out.set(row.userId, row.n);
    }
    return out;
  }
}
