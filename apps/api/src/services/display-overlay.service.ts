import type { ISaleroomDisplaySessionRepository } from "@auction/persistence/interfaces";
import type { SaleroomDisplayOverlay } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type {
  DisplayServiceError,
  IDisplayOverlayService,
} from "./interfaces/display-overlay-service.js";
import type { ISaleroomRealtimePublisher } from "./interfaces/saleroom-realtime-publisher.js";

export type DisplayOverlayServiceOptions = {
  saleroomDisplaySessionRepo: ISaleroomDisplaySessionRepository;
  publisher: ISaleroomRealtimePublisher;
  domainEventSink: IDomainEventSink;
};

export class DisplayOverlayService implements IDisplayOverlayService {
  private readonly saleroomDisplaySessionRepo: ISaleroomDisplaySessionRepository;
  private readonly publisher: ISaleroomRealtimePublisher;
  private readonly domainEventSink: IDomainEventSink;

  constructor(opts: DisplayOverlayServiceOptions) {
    this.saleroomDisplaySessionRepo = opts.saleroomDisplaySessionRepo;
    this.publisher = opts.publisher;
    this.domainEventSink = opts.domainEventSink;
  }

  async setOverlay(input: {
    saleId: string;
    kind: "fair_warning" | "announcement";
    message?: string;
    actorUserId: string;
  }): Promise<Result<SaleroomDisplayOverlay, DisplayServiceError>> {
    const overlay: SaleroomDisplayOverlay = {
      kind: input.kind,
      ...(input.message != null && input.message.trim() !== ""
        ? { message: input.message.trim() }
        : {}),
      emittedAt: new Date().toISOString(),
    };

    const { updated } = await this.saleroomDisplaySessionRepo.setDisplayOverlay({
      saleId: input.saleId,
      overlay,
    });

    if (!updated) {
      return err({
        message: "Saleroom session not found; go live first",
        status: 404,
        code: "session_not_found",
      });
    }

    await this.publisher.publishDisplayControl(input.saleId, {
      kind: input.kind,
      ...(overlay.message ? { message: overlay.message } : {}),
      emittedAt: overlay.emittedAt,
    });

    await this.domainEventSink.publish({
      aggregateType: "sale",
      aggregateId: input.saleId,
      eventType: "saleroom.display.overlay_set",
      payload: { kind: input.kind, ...(overlay.message ? { message: overlay.message } : {}) },
      actorUserId: input.actorUserId,
    });

    return ok(overlay);
  }

  async clearOverlay(input: {
    saleId: string;
    actorUserId: string;
  }): Promise<Result<void, DisplayServiceError>> {
    const emittedAt = new Date().toISOString();
    const { updated } = await this.saleroomDisplaySessionRepo.clearDisplayOverlay(input.saleId);

    if (!updated) {
      return err({
        message: "Saleroom session not found",
        status: 404,
        code: "session_not_found",
      });
    }

    await this.publisher.publishDisplayControl(input.saleId, {
      kind: "clear",
      emittedAt,
    });

    await this.domainEventSink.publish({
      aggregateType: "sale",
      aggregateId: input.saleId,
      eventType: "saleroom.display.overlay_clear",
      payload: {},
      actorUserId: input.actorUserId,
    });

    return ok(undefined);
  }
}
