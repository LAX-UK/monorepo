import type { Database } from "@auction/db";
import { payment, sourceOfFunds } from "@auction/db/schema";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type {
  CreateSourceOfFundsCaseInput,
  ISourceOfFundsRepository,
  SourceOfFundsCase,
  SourceOfFundsReviewInput,
  SourceOfFundsStatus,
  SourceOfFundsTriageInput,
  SourceOfFundsTriageRecommendation,
} from "../services/source-of-funds/source-of-funds.types.js";

/** Payment statuses that represent live or settled buyer exposure for SoF aggregation. */
const ACTIVE_PAYMENT_STATUSES = [
  "pending",
  "authorized",
  "captured",
  "requires_manual_review",
] as const;

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

  async listByStatus(
    status: SourceOfFundsStatus,
    limit: number,
    conn?: Database,
  ): Promise<SourceOfFundsCase[]> {
    const cap = Math.min(200, Math.max(1, limit));
    const rows = await this.conn(conn)
      .select()
      .from(sourceOfFunds)
      .where(eq(sourceOfFunds.status, status))
      .orderBy(desc(sourceOfFunds.createdAt))
      .limit(cap);
    return rows.map(rowToCase);
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
        updatedAt: new Date(),
      })
      .where(and(eq(sourceOfFunds.id, id), eq(sourceOfFunds.status, "rejected")))
      .returning();
    return row ? rowToCase(row) : null;
  }

  async sumActiveBuyerSettlementPence(
    userId: string,
    excludePaymentId?: string,
    conn?: Database,
  ): Promise<number> {
    const conditions = [
      eq(payment.buyerId, userId),
      inArray(payment.status, [...ACTIVE_PAYMENT_STATUSES]),
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
}
