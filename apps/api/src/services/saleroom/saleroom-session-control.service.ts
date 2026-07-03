import type { SaleroomEventKind } from "@auction/persistence";
import { isSaleroomDeliveryMode } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import type {
  ISaleroomSessionControlService,
  SaleroomServiceError,
} from "../interfaces/saleroom-service.js";
import type { SaleroomDisplayControlService } from "./saleroom-display-control.service.js";
import { type SaleroomSessionContext, publishSaleroomEvent } from "./saleroom-session-context.js";

type LiveSession = NonNullable<
  Awaited<ReturnType<SaleroomSessionContext["sessionRepo"]["findBySaleId"]>>
>;

export class SaleroomSessionControlService implements ISaleroomSessionControlService {
  constructor(
    private readonly ctx: SaleroomSessionContext,
    private readonly display: SaleroomDisplayControlService,
  ) {}

  async goLive(input: {
    saleId: string;
    actorUserId: string;
  }): Promise<Result<{ sessionId: string; status: string }, SaleroomServiceError>> {
    const sale = await this.ctx.saleRepo.findById(input.saleId);
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

    const session = await this.ctx.sessionRepo.upsertPending(input.saleId, input.actorUserId);
    if (session.status === "live") {
      return ok({ sessionId: session.id, status: session.status });
    }

    const startedAt = session.startedAt ?? new Date();
    await this.ctx.sessionRepo.markLive({
      sessionId: session.id,
      clerkUserId: input.actorUserId,
      startedAt,
    });

    await this.ctx.sessionRepo.appendEvent({
      sessionId: session.id,
      kind: "opened",
      payload: {},
      actorUserId: input.actorUserId,
    });
    await publishSaleroomEvent(this.ctx.redis, input.saleId, { kind: "opened" });

    const saleLots = await this.ctx.lotRepo.findBySaleId(input.saleId);
    for (const lotRow of saleLots) {
      if (lotRow.status === "active") {
        await this.ctx.lotJobs?.cancelLotEndJob(lotRow.id);
      }
    }

    return ok({ sessionId: session.id, status: "live" });
  }

  async pause(input: {
    saleId: string;
    actorUserId: string;
  }): Promise<Result<{ sessionId: string }, SaleroomServiceError>> {
    const session = await this.ctx.sessionRepo.findBySaleId(input.saleId);
    if (!session) return err({ message: "Saleroom session not found", status: 404 });
    if (session.status !== "live") {
      return err({ message: "Saleroom must be live to pause", status: 400 });
    }
    await this.ctx.sessionRepo.markPaused(session.id);
    await this.appendEventAndPublish(session, input.saleId, "paused", {}, input.actorUserId);
    return ok({ sessionId: session.id });
  }

  async resume(input: {
    saleId: string;
    actorUserId: string;
  }): Promise<Result<{ sessionId: string }, SaleroomServiceError>> {
    const session = await this.ctx.sessionRepo.findBySaleId(input.saleId);
    if (!session) return err({ message: "Saleroom session not found", status: 404 });
    if (session.status !== "paused") {
      return err({ message: "Session is not paused", status: 400 });
    }
    await this.ctx.sessionRepo.markResumed(session.id);
    await this.appendEventAndPublish(session, input.saleId, "resumed", {}, input.actorUserId);
    return ok({ sessionId: session.id });
  }

  async advanceToLot(input: {
    saleId: string;
    lotId: string;
    actorUserId: string;
  }): Promise<Result<{ sessionId: string; currentLotId: string }, SaleroomServiceError>> {
    const session = await this.ctx.sessionRepo.findBySaleId(input.saleId);
    if (!session) return err({ message: "Saleroom session not found; go live first", status: 404 });
    if (session.status !== "live") {
      return err({ message: "Saleroom must be live to advance lots", status: 400 });
    }

    const lotRow = await this.ctx.lotRepo.findById(input.lotId);
    if (!lotRow || lotRow.saleId !== input.saleId) {
      return err({ message: "Lot not found on this sale", status: 404 });
    }

    if (lotRow.status === "ended" || lotRow.status === "cancelled") {
      return err({
        message: "This lot has already closed and cannot be put on the block",
        status: 400,
      });
    }

    if (lotRow.status === "scheduled") {
      await this.ctx.lotLifecycle.processActivateJob(input.lotId);
    }

    const activeLot = await this.ctx.lotRepo.findById(input.lotId);
    if (!activeLot || activeLot.status !== "active") {
      return err({
        message: "Lot must be active before it can be put on the block",
        status: 400,
      });
    }

    await this.ctx.sessionRepo.setCurrentLot(session.id, input.lotId);
    await this.display.clearDisplayOverlayIfAny(input.saleId);
    await this.appendEventAndPublish(
      session,
      input.saleId,
      "advanced_to_lot",
      { lotId: input.lotId },
      input.actorUserId,
    );
    return ok({ sessionId: session.id, currentLotId: input.lotId });
  }

  async hammerCurrentLot(input: {
    saleId: string;
    actorUserId: string;
  }): Promise<Result<{ lotId: string }, SaleroomServiceError>> {
    return this.resolveLotOutcome(input, {
      finalize: (lotId) => this.ctx.lotLifecycle.finalizeActiveLotFromClerkHammer(lotId),
      failureMessage: "Could not hammer this lot (not active or already closed)",
      eventKind: "hammer",
    });
  }

  async noSaleCurrentLot(input: {
    saleId: string;
    actorUserId: string;
  }): Promise<Result<{ lotId: string }, SaleroomServiceError>> {
    return this.resolveLotOutcome(input, {
      finalize: (lotId) => this.ctx.lotLifecycle.noSaleEndActiveLotFromClerk(lotId),
      failureMessage: "Could not declare no sale for this lot",
      eventKind: "no_sale",
    });
  }

  async closeSession(input: {
    saleId: string;
    actorUserId: string;
  }): Promise<Result<{ sessionId: string }, SaleroomServiceError>> {
    const session = await this.ctx.sessionRepo.findBySaleId(input.saleId);
    if (!session) return err({ message: "Saleroom session not found", status: 404 });
    await this.ctx.sessionRepo.markEnded(session.id, new Date());
    await this.ctx.telephoneBidBookingService?.closeAllOpenForSale(input.saleId);
    await this.ctx.lotLifecycle.finalizeActiveLotsPastEnd(input.saleId);
    await this.appendEventAndPublish(session, input.saleId, "closed", {}, input.actorUserId);
    return ok({ sessionId: session.id });
  }

  private async resolveLotOutcome(
    input: { saleId: string; actorUserId: string },
    options: {
      finalize: (lotId: string) => Promise<unknown>;
      failureMessage: string;
      eventKind: Extract<SaleroomEventKind, "hammer" | "no_sale">;
    },
  ): Promise<Result<{ lotId: string }, SaleroomServiceError>> {
    const session = await this.ctx.sessionRepo.findBySaleId(input.saleId);
    if (!session) return err({ message: "Saleroom session not found", status: 404 });
    if (session.status !== "live") {
      return err({ message: "Saleroom must be live", status: 400 });
    }
    const lotId = session.currentLotId;
    if (!lotId) {
      return err({
        message: options.eventKind === "hammer" ? "No current lot to hammer" : "No current lot",
        status: 400,
      });
    }

    const outcome = await options.finalize(lotId);
    if (!outcome) {
      return err({ message: options.failureMessage, status: 400 });
    }

    await this.ctx.lotJobs?.cancelLotJobs(lotId);
    await this.ctx.sessionRepo.clearCurrentLot(session.id);
    await this.display.clearDisplayOverlayIfAny(input.saleId);
    await this.ctx.telephoneBidBookingService?.completeLinesForLot(input.saleId, lotId);
    await this.appendEventAndPublish(
      session,
      input.saleId,
      options.eventKind,
      { lotId },
      input.actorUserId,
    );
    return ok({ lotId });
  }

  private async appendEventAndPublish(
    session: LiveSession,
    saleId: string,
    kind: SaleroomEventKind,
    payload: Record<string, unknown>,
    actorUserId: string,
  ): Promise<void> {
    await this.ctx.sessionRepo.appendEvent({
      sessionId: session.id,
      kind,
      payload,
      actorUserId,
    });
    await publishSaleroomEvent(this.ctx.redis, saleId, { kind, ...payload });
  }
}
