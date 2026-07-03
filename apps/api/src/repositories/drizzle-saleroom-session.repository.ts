import type { Database } from "@auction/db";
import { saleroomEvent, saleroomSession } from "@auction/db/schema";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import type {
  ISaleroomSessionRepository,
  SaleroomEventKind,
  SaleroomSessionRow,
} from "./interfaces/saleroom-session.repository.js";

export class DrizzleSaleroomSessionRepository implements ISaleroomSessionRepository {
  constructor(private readonly db: Database) {}

  async findBySaleId(saleId: string): Promise<SaleroomSessionRow | null> {
    const [session] = await this.db
      .select()
      .from(saleroomSession)
      .where(eq(saleroomSession.saleId, saleId))
      .limit(1);
    return session ?? null;
  }

  async findStatusSummariesBySaleIds(saleIds: readonly string[]) {
    const uniqueIds = [...new Set(saleIds.filter(Boolean))];
    if (uniqueIds.length === 0) return [];

    const rows = await this.db
      .select({
        saleId: saleroomSession.saleId,
        status: saleroomSession.status,
        currentLotId: saleroomSession.currentLotId,
      })
      .from(saleroomSession)
      .where(inArray(saleroomSession.saleId, uniqueIds));

    return rows.map((row) => ({
      saleId: row.saleId,
      status: row.status,
      currentLotId: row.currentLotId ?? null,
    }));
  }

  async upsertPending(saleId: string, clerkUserId: string): Promise<SaleroomSessionRow> {
    const now = new Date();
    const [row] = await this.db
      .insert(saleroomSession)
      .values({
        saleId,
        clerkUserId,
        status: "pending",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: saleroomSession.saleId,
        set: {
          clerkUserId,
          updatedAt: now,
        },
      })
      .returning();
    if (!row) {
      throw new Error("Expected saleroom session row after upsert");
    }
    return row;
  }

  async markLive(input: {
    sessionId: string;
    clerkUserId: string;
    startedAt: Date;
  }): Promise<void> {
    await this.db
      .update(saleroomSession)
      .set({
        status: "live",
        startedAt: input.startedAt,
        clerkUserId: input.clerkUserId,
        updatedAt: new Date(),
      })
      .where(eq(saleroomSession.id, input.sessionId));
  }

  async markPaused(sessionId: string): Promise<void> {
    await this.db
      .update(saleroomSession)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(saleroomSession.id, sessionId));
  }

  async markResumed(sessionId: string): Promise<void> {
    await this.db
      .update(saleroomSession)
      .set({ status: "live", updatedAt: new Date() })
      .where(eq(saleroomSession.id, sessionId));
  }

  async setCurrentLot(sessionId: string, lotId: string): Promise<void> {
    await this.db
      .update(saleroomSession)
      .set({ currentLotId: lotId, updatedAt: new Date() })
      .where(eq(saleroomSession.id, sessionId));
  }

  async clearCurrentLot(sessionId: string): Promise<void> {
    await this.db
      .update(saleroomSession)
      .set({ currentLotId: null, updatedAt: new Date() })
      .where(eq(saleroomSession.id, sessionId));
  }

  async markEnded(sessionId: string, endedAt: Date): Promise<void> {
    await this.db
      .update(saleroomSession)
      .set({
        status: "ended",
        endedAt,
        currentLotId: null,
        updatedAt: new Date(),
      })
      .where(eq(saleroomSession.id, sessionId));
  }

  async clearDisplayOverlay(saleId: string): Promise<{ cleared: boolean }> {
    const [updated] = await this.db
      .update(saleroomSession)
      .set({
        displayOverlay: null,
        displayOverlayAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(saleroomSession.saleId, saleId), isNotNull(saleroomSession.displayOverlay)))
      .returning({ id: saleroomSession.id });
    return { cleared: Boolean(updated) };
  }

  async appendEvent(input: {
    sessionId: string;
    kind: SaleroomEventKind;
    payload: Record<string, unknown>;
    actorUserId: string;
  }): Promise<void> {
    await this.db.insert(saleroomEvent).values({
      sessionId: input.sessionId,
      kind: input.kind,
      payload: input.payload,
      actorUserId: input.actorUserId,
    });
  }

  async listRecentEvents(sessionId: string, limit = 50) {
    return this.db
      .select()
      .from(saleroomEvent)
      .where(eq(saleroomEvent.sessionId, sessionId))
      .orderBy(desc(saleroomEvent.occurredAt))
      .limit(limit);
  }
}
