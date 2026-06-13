import type { Database } from "@auction/db";
import { kycWatchlistScreening, user } from "@auction/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type {
  AmlHoldReason,
  AmlHoldStatus,
  AmlReviewStatus,
  AmlScreeningHit,
  AmlTriageRecommendation,
  AmlWatchlistCategory,
} from "../services/aml/aml-types.js";
import type {
  IAmlHoldStore,
  IWatchlistScreeningReader,
  IWatchlistScreeningWriter,
  UpsertWatchlistScreeningInput,
  WatchlistReviewOutcomeInput,
  WatchlistScreeningRecord,
  WatchlistTriageInput,
} from "../services/aml/ports.js";

function rowToRecord(row: typeof kycWatchlistScreening.$inferSelect): WatchlistScreeningRecord {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    providerSessionId: row.providerSessionId,
    matchStatus: row.matchStatus,
    monitorStatus: row.monitorStatus,
    totalHits: row.totalHits,
    categories: (row.categories ?? []) as AmlWatchlistCategory[],
    hits: (row.hits ?? []) as AmlScreeningHit[],
    checkType:
      row.checkType === "initial_result" || row.checkType === "updated_result"
        ? row.checkType
        : null,
    decisionOutcome: row.decisionOutcome,
    reviewStatus: row.reviewStatus,
    triageRecommendation: (row.triageRecommendation as AmlTriageRecommendation | null) ?? null,
    triagedByUserId: row.triagedByUserId ?? null,
    triagedAt: row.triagedAt ?? null,
    triageNotes: row.triageNotes ?? null,
    reviewedByUserId: row.reviewedByUserId ?? null,
    reviewedAt: row.reviewedAt ?? null,
    reviewNotes: row.reviewNotes ?? null,
    screenedAt: row.screenedAt,
    createdAt: row.createdAt,
  };
}

export class DrizzleAmlScreeningRepository
  implements IWatchlistScreeningReader, IWatchlistScreeningWriter
{
  constructor(private readonly db: Database) {}

  private conn(conn?: Database): Database {
    return conn ?? this.db;
  }

  async findById(id: string, conn?: Database): Promise<WatchlistScreeningRecord | null> {
    const rows = await this.conn(conn)
      .select()
      .from(kycWatchlistScreening)
      .where(eq(kycWatchlistScreening.id, id))
      .limit(1);
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  async findLatestByUserId(
    userId: string,
    conn?: Database,
  ): Promise<WatchlistScreeningRecord | null> {
    const rows = await this.conn(conn)
      .select()
      .from(kycWatchlistScreening)
      .where(eq(kycWatchlistScreening.userId, userId))
      .orderBy(desc(kycWatchlistScreening.screenedAt))
      .limit(1);
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  async findByProviderSessionId(
    providerSessionId: string,
    conn?: Database,
  ): Promise<WatchlistScreeningRecord | null> {
    const rows = await this.conn(conn)
      .select()
      .from(kycWatchlistScreening)
      .where(eq(kycWatchlistScreening.providerSessionId, providerSessionId))
      .limit(1);
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  async listByReviewStatus(
    reviewStatus: AmlReviewStatus,
    limit: number,
    offset = 0,
    conn?: Database,
  ): Promise<WatchlistScreeningRecord[]> {
    const cap = Math.min(200, Math.max(1, limit));
    const skip = Math.max(0, offset);
    const rows = await this.conn(conn)
      .select()
      .from(kycWatchlistScreening)
      .where(eq(kycWatchlistScreening.reviewStatus, reviewStatus))
      .orderBy(desc(kycWatchlistScreening.screenedAt))
      .limit(cap)
      .offset(skip);
    return rows.map(rowToRecord);
  }

  async countByReviewStatus(reviewStatus: AmlReviewStatus, conn?: Database): Promise<number> {
    const [row] = await this.conn(conn)
      .select({ n: sql<number>`count(*)::int` })
      .from(kycWatchlistScreening)
      .where(eq(kycWatchlistScreening.reviewStatus, reviewStatus));
    return row?.n ?? 0;
  }

  async listForUser(
    userId: string,
    limit: number,
    conn?: Database,
  ): Promise<WatchlistScreeningRecord[]> {
    const cap = Math.min(50, Math.max(1, limit));
    const rows = await this.conn(conn)
      .select()
      .from(kycWatchlistScreening)
      .where(eq(kycWatchlistScreening.userId, userId))
      .orderBy(desc(kycWatchlistScreening.screenedAt))
      .limit(cap);
    return rows.map(rowToRecord);
  }

  async upsertFromResult(
    input: UpsertWatchlistScreeningInput,
    conn?: Database,
  ): Promise<WatchlistScreeningRecord> {
    const { userId, result, decision, reviewStatus } = input;
    const [row] = await this.conn(conn)
      .insert(kycWatchlistScreening)
      .values({
        userId,
        provider: result.provider,
        providerSessionId: result.providerSessionId,
        matchStatus: result.matchStatus,
        monitorStatus: result.monitorStatus,
        totalHits: result.totalHits,
        categories: result.categories,
        hits: result.hits,
        checkType: input.checkType ?? null,
        decisionOutcome: decision.outcome,
        reviewStatus,
        payload: result.rawPayload,
        screenedAt: result.screenedAt,
      })
      .onConflictDoUpdate({
        target: kycWatchlistScreening.providerSessionId,
        set: {
          matchStatus: result.matchStatus,
          monitorStatus: result.monitorStatus,
          totalHits: result.totalHits,
          categories: result.categories,
          hits: result.hits,
          checkType: input.checkType ?? null,
          decisionOutcome: decision.outcome,
          reviewStatus,
          // A fresh provider result supersedes any prior human disposition.
          triageRecommendation: null,
          triagedByUserId: null,
          triagedAt: null,
          triageNotes: null,
          reviewedByUserId: null,
          reviewedAt: null,
          reviewNotes: null,
          payload: result.rawPayload,
          screenedAt: result.screenedAt,
        },
      })
      .returning();
    if (!row) throw new Error("aml_screening_upsert_failed");
    return rowToRecord(row);
  }

  async setTriage(
    id: string,
    input: WatchlistTriageInput,
    conn?: Database,
  ): Promise<WatchlistScreeningRecord | null> {
    const [row] = await this.conn(conn)
      .update(kycWatchlistScreening)
      .set({
        triageRecommendation: input.recommendation,
        triagedByUserId: input.triagedByUserId,
        triagedAt: new Date(),
        triageNotes: input.triageNotes,
      })
      .where(
        and(
          eq(kycWatchlistScreening.id, id),
          eq(kycWatchlistScreening.reviewStatus, "pending"),
          isNull(kycWatchlistScreening.triageRecommendation),
        ),
      )
      .returning();
    return row ? rowToRecord(row) : null;
  }

  async setReviewOutcome(
    id: string,
    input: WatchlistReviewOutcomeInput,
    conn?: Database,
  ): Promise<WatchlistScreeningRecord | null> {
    const [row] = await this.conn(conn)
      .update(kycWatchlistScreening)
      .set({
        reviewStatus: input.reviewStatus,
        reviewedByUserId: input.reviewedByUserId,
        reviewedAt: new Date(),
        reviewNotes: input.reviewNotes,
      })
      .where(
        and(eq(kycWatchlistScreening.id, id), eq(kycWatchlistScreening.reviewStatus, "pending")),
      )
      .returning();
    return row ? rowToRecord(row) : null;
  }

  async setMonitorStatus(
    providerSessionId: string,
    monitorStatus: WatchlistScreeningRecord["monitorStatus"],
    conn?: Database,
  ): Promise<void> {
    await this.conn(conn)
      .update(kycWatchlistScreening)
      .set({ monitorStatus })
      .where(eq(kycWatchlistScreening.providerSessionId, providerSessionId));
  }
}

export class DrizzleAmlHoldStore implements IAmlHoldStore {
  constructor(private readonly db: Database) {}

  private conn(conn?: Database): Database {
    return conn ?? this.db;
  }

  async setHold(
    userId: string,
    status: Extract<AmlHoldStatus, "hold" | "blocked">,
    reason: AmlHoldReason,
    conn?: Database,
  ): Promise<void> {
    await this.conn(conn)
      .update(user)
      .set({
        amlHoldStatus: status,
        amlHoldReason: reason,
        amlHoldAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
  }

  async clearHold(userId: string, conn?: Database): Promise<void> {
    await this.conn(conn)
      .update(user)
      .set({
        amlHoldStatus: "none",
        amlHoldReason: null,
        amlHoldAt: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
  }

  async getHold(
    userId: string,
    conn?: Database,
  ): Promise<{ status: AmlHoldStatus; reason: AmlHoldReason | null } | null> {
    const rows = await this.conn(conn)
      .select({ status: user.amlHoldStatus, reason: user.amlHoldReason })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return { status: row.status, reason: (row.reason as AmlHoldReason | null) ?? null };
  }
}
