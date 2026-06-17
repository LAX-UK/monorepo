import type { Database } from "@auction/db";
import { saleroomEvent, saleroomSession } from "@auction/db/schema";
import { isSaleroomDeliveryMode } from "@auction/validators";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import type { Redis } from "ioredis";
import { type Result, err, ok } from "neverthrow";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ILotRepository, ISaleRepository } from "./interfaces/repositories.js";
import type { ISaleroomRealtimePublisher } from "./interfaces/saleroom-realtime-publisher.js";
import type {
  ISaleroomService,
  SaleroomServiceError,
  SaleroomSessionStatusRow,
} from "./interfaces/saleroom-service.js";
import type { ITelephoneBidBookingService } from "./interfaces/telephone-bid-booking-service.js";
import type { LotLifecycleService } from "./lot-lifecycle.service.js";

export type { SaleroomServiceError } from "./interfaces/saleroom-service.js";

const SALEROOM_CHANNEL = (saleId: string) => `sale:${saleId}:saleroom`;

export type SaleroomServiceOptions = {
  db: Database;
  redis: Redis;
  lotLifecycle: LotLifecycleService;
  saleRepo: ISaleRepository;
  lotRepo: ILotRepository;
  lotJobs: ILotJobScheduler | null;
  telephoneBidBookingService?: ITelephoneBidBookingService | null;
  displayPublisher?: ISaleroomRealtimePublisher | null;
};

export class SaleroomService implements ISaleroomService {
  private readonly db: Database;
  private readonly redis: Redis;
  private readonly lotLifecycle: LotLifecycleService;
  private readonly saleRepo: ISaleRepository;
  private readonly lotRepo: ILotRepository;
  private readonly lotJobs: ILotJobScheduler | null;
  private readonly telephoneBidBookingService: ITelephoneBidBookingService | null;
  private readonly displayPublisher: ISaleroomRealtimePublisher | null;

  constructor(opts: SaleroomServiceOptions) {
    this.db = opts.db;
    this.redis = opts.redis;
    this.lotLifecycle = opts.lotLifecycle;
    this.saleRepo = opts.saleRepo;
    this.lotRepo = opts.lotRepo;
    this.lotJobs = opts.lotJobs;
    this.telephoneBidBookingService = opts.telephoneBidBookingService ?? null;
    this.displayPublisher = opts.displayPublisher ?? null;
  }

  private async completeTelephoneLinesForLot(saleId: string, lotId: string): Promise<void> {
    await this.telephoneBidBookingService?.completeLinesForLot(saleId, lotId);
  }

  private async publish(saleId: string, body: Record<string, unknown>): Promise<void> {
    await this.redis.publish(
      SALEROOM_CHANNEL(saleId),
      JSON.stringify({ ...body, saleId, emittedAt: new Date().toISOString() }),
    );
  }

  private async clearDisplayOverlayIfAny(saleId: string): Promise<void> {
    const [updated] = await this.db
      .update(saleroomSession)
      .set({
        displayOverlay: null,
        displayOverlayAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(saleroomSession.saleId, saleId), isNotNull(saleroomSession.displayOverlay)))
      .returning({ id: saleroomSession.id });

    if (updated && this.displayPublisher) {
      await this.displayPublisher.publishDisplayControl(saleId, {
        kind: "clear",
        emittedAt: new Date().toISOString(),
      });
    }
  }

  private async publishDisplayBidSummary(input: {
    saleId: string;
    lotId: string;
    currentPrice: string;
    bidCount: number;
    leaderPaddleNumber: number | null;
  }): Promise<void> {
    if (!this.displayPublisher) return;
    await this.displayPublisher.publishDisplayControl(input.saleId, {
      kind: "bid_summary",
      lotId: input.lotId,
      currentPrice: input.currentPrice,
      bidCount: input.bidCount,
      leaderPaddleNumber: input.leaderPaddleNumber,
      emittedAt: new Date().toISOString(),
    });
  }

  async publishClerkPaddleBidSummary(input: {
    saleId: string;
    lotId: string;
    currentPrice: string;
    bidCount: number;
    leaderPaddleNumber: number | null;
  }): Promise<void> {
    await this.publishDisplayBidSummary(input);
  }

  private async insertEvent(
    sessionId: string,
    kind: "opened" | "advanced_to_lot" | "hammer" | "no_sale" | "paused" | "resumed" | "closed",
    payload: Record<string, unknown>,
    actorUserId: string,
  ): Promise<void> {
    await this.db.insert(saleroomEvent).values({
      sessionId,
      kind,
      payload,
      actorUserId,
    });
  }

  async getPublicSessionStatus(saleId: string): Promise<{
    status: "none" | "pending" | "live" | "paused" | "ended";
    currentLotId: string | null;
  }> {
    const [session] = await this.db
      .select({
        status: saleroomSession.status,
        currentLotId: saleroomSession.currentLotId,
      })
      .from(saleroomSession)
      .where(eq(saleroomSession.saleId, saleId))
      .limit(1);
    if (!session) {
      return { status: "none", currentLotId: null };
    }
    return {
      status: session.status,
      currentLotId: session.currentLotId ?? null,
    };
  }

  async getSessionStatuses(saleIds: readonly string[]): Promise<SaleroomSessionStatusRow[]> {
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

    const bySaleId = new Map(rows.map((row) => [row.saleId, row]));
    return uniqueIds.map((saleId) => {
      const row = bySaleId.get(saleId);
      if (!row) {
        return { saleId, status: "none" as const, currentLotId: null };
      }
      return {
        saleId,
        status: row.status,
        currentLotId: row.currentLotId ?? null,
      };
    });
  }

  async getSessionWithRecentEvents(saleId: string): Promise<{
    session: typeof saleroomSession.$inferSelect | null;
    events: (typeof saleroomEvent.$inferSelect)[];
  }> {
    const [session] = await this.db
      .select()
      .from(saleroomSession)
      .where(eq(saleroomSession.saleId, saleId))
      .limit(1);
    if (!session) {
      return { session: null, events: [] };
    }
    const events = await this.db
      .select()
      .from(saleroomEvent)
      .where(eq(saleroomEvent.sessionId, session.id))
      .orderBy(desc(saleroomEvent.occurredAt))
      .limit(50);
    return { session, events };
  }

  private async ensureSession(saleId: string, clerkUserId: string) {
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

  async goLive(input: {
    saleId: string;
    actorUserId: string;
  }): Promise<Result<{ sessionId: string; status: string }, SaleroomServiceError>> {
    const sale = await this.saleRepo.findById(input.saleId);
    if (!sale) return err({ message: "Sale not found", status: 404 });
    if (!isSaleroomDeliveryMode(sale.deliveryMode)) {
      return err({
        message: "Saleroom sessions are only available for onsite and hybrid sales",
        status: 400,
      });
    }
    if (sale.status !== "active") {
      return err({ message: "Sale must be active to open the saleroom", status: 400 });
    }

    const session = await this.ensureSession(input.saleId, input.actorUserId);
    if (session.status === "live") {
      return ok({ sessionId: session.id, status: session.status });
    }

    const startedAt = session.startedAt ?? new Date();
    await this.db
      .update(saleroomSession)
      .set({
        status: "live",
        startedAt,
        clerkUserId: input.actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(saleroomSession.id, session.id));

    await this.insertEvent(session.id, "opened", {}, input.actorUserId);
    await this.publish(input.saleId, { kind: "opened" });

    const saleLots = await this.lotRepo.findBySaleId(input.saleId);
    for (const lotRow of saleLots) {
      if (lotRow.status === "active") {
        await this.lotJobs?.cancelLotEndJob(lotRow.id);
      }
    }

    return ok({ sessionId: session.id, status: "live" });
  }

  async pause(input: {
    saleId: string;
    actorUserId: string;
  }): Promise<Result<{ sessionId: string }, SaleroomServiceError>> {
    const [s] = await this.db
      .select()
      .from(saleroomSession)
      .where(eq(saleroomSession.saleId, input.saleId))
      .limit(1);
    if (!s) return err({ message: "Saleroom session not found", status: 404 });
    if (s.status !== "live") {
      return err({ message: "Saleroom must be live to pause", status: 400 });
    }
    await this.db
      .update(saleroomSession)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(saleroomSession.id, s.id));
    await this.insertEvent(s.id, "paused", {}, input.actorUserId);
    await this.publish(input.saleId, { kind: "paused" });
    return ok({ sessionId: s.id });
  }

  async resume(input: {
    saleId: string;
    actorUserId: string;
  }): Promise<Result<{ sessionId: string }, SaleroomServiceError>> {
    const [row] = await this.db
      .select()
      .from(saleroomSession)
      .where(eq(saleroomSession.saleId, input.saleId))
      .limit(1);
    if (!row) return err({ message: "Saleroom session not found", status: 404 });
    if (row.status !== "paused") {
      return err({ message: "Session is not paused", status: 400 });
    }
    await this.db
      .update(saleroomSession)
      .set({ status: "live", updatedAt: new Date() })
      .where(eq(saleroomSession.id, row.id));
    await this.insertEvent(row.id, "resumed", {}, input.actorUserId);
    await this.publish(input.saleId, { kind: "resumed" });
    return ok({ sessionId: row.id });
  }

  async advanceToLot(input: {
    saleId: string;
    lotId: string;
    actorUserId: string;
  }): Promise<Result<{ sessionId: string; currentLotId: string }, SaleroomServiceError>> {
    const [session] = await this.db
      .select()
      .from(saleroomSession)
      .where(eq(saleroomSession.saleId, input.saleId))
      .limit(1);
    if (!session) return err({ message: "Saleroom session not found; go live first", status: 404 });
    if (session.status !== "live") {
      return err({ message: "Saleroom must be live to advance lots", status: 400 });
    }

    const lotRow = await this.lotRepo.findById(input.lotId);
    if (!lotRow || lotRow.saleId !== input.saleId) {
      return err({ message: "Lot not found on this sale", status: 404 });
    }

    await this.db
      .update(saleroomSession)
      .set({ currentLotId: input.lotId, updatedAt: new Date() })
      .where(eq(saleroomSession.id, session.id));

    await this.clearDisplayOverlayIfAny(input.saleId);

    await this.insertEvent(
      session.id,
      "advanced_to_lot",
      { lotId: input.lotId },
      input.actorUserId,
    );
    await this.publish(input.saleId, { kind: "advanced_to_lot", lotId: input.lotId });
    return ok({ sessionId: session.id, currentLotId: input.lotId });
  }

  async hammerCurrentLot(input: {
    saleId: string;
    actorUserId: string;
  }): Promise<Result<{ lotId: string }, SaleroomServiceError>> {
    const [session] = await this.db
      .select()
      .from(saleroomSession)
      .where(eq(saleroomSession.saleId, input.saleId))
      .limit(1);
    if (!session) return err({ message: "Saleroom session not found", status: 404 });
    if (session.status !== "live") {
      return err({ message: "Saleroom must be live", status: 400 });
    }
    const lotId = session.currentLotId;
    if (!lotId) {
      return err({ message: "No current lot to hammer", status: 400 });
    }

    const outcome = await this.lotLifecycle.finalizeActiveLotFromClerkHammer(lotId);
    if (!outcome) {
      return err({
        message: "Could not hammer this lot (not active or already closed)",
        status: 400,
      });
    }

    await this.lotJobs?.cancelLotJobs(lotId);

    await this.db
      .update(saleroomSession)
      .set({ currentLotId: null, updatedAt: new Date() })
      .where(eq(saleroomSession.id, session.id));

    await this.clearDisplayOverlayIfAny(input.saleId);

    await this.completeTelephoneLinesForLot(input.saleId, lotId);
    await this.insertEvent(session.id, "hammer", { lotId }, input.actorUserId);
    await this.publish(input.saleId, { kind: "hammer", lotId });
    return ok({ lotId });
  }

  async noSaleCurrentLot(input: {
    saleId: string;
    actorUserId: string;
  }): Promise<Result<{ lotId: string }, SaleroomServiceError>> {
    const [session] = await this.db
      .select()
      .from(saleroomSession)
      .where(eq(saleroomSession.saleId, input.saleId))
      .limit(1);
    if (!session) return err({ message: "Saleroom session not found", status: 404 });
    if (session.status !== "live") {
      return err({ message: "Saleroom must be live", status: 400 });
    }
    const lotId = session.currentLotId;
    if (!lotId) {
      return err({ message: "No current lot", status: 400 });
    }

    const closed = await this.lotLifecycle.noSaleEndActiveLotFromClerk(lotId);
    if (!closed) {
      return err({ message: "Could not declare no sale for this lot", status: 400 });
    }

    await this.lotJobs?.cancelLotJobs(lotId);

    await this.db
      .update(saleroomSession)
      .set({ currentLotId: null, updatedAt: new Date() })
      .where(eq(saleroomSession.id, session.id));

    await this.clearDisplayOverlayIfAny(input.saleId);

    await this.completeTelephoneLinesForLot(input.saleId, lotId);
    await this.insertEvent(session.id, "no_sale", { lotId }, input.actorUserId);
    await this.publish(input.saleId, { kind: "no_sale", lotId });
    return ok({ lotId });
  }

  async closeSession(input: {
    saleId: string;
    actorUserId: string;
  }): Promise<Result<{ sessionId: string }, SaleroomServiceError>> {
    const [session] = await this.db
      .select()
      .from(saleroomSession)
      .where(eq(saleroomSession.saleId, input.saleId))
      .limit(1);
    if (!session) return err({ message: "Saleroom session not found", status: 404 });
    await this.db
      .update(saleroomSession)
      .set({
        status: "ended",
        endedAt: new Date(),
        currentLotId: null,
        updatedAt: new Date(),
      })
      .where(eq(saleroomSession.id, session.id));
    await this.telephoneBidBookingService?.closeAllOpenForSale(input.saleId);
    await this.lotLifecycle.finalizeActiveLotsPastEnd(input.saleId);
    await this.insertEvent(session.id, "closed", {}, input.actorUserId);
    await this.publish(input.saleId, { kind: "closed" });
    return ok({ sessionId: session.id });
  }
}
