import type { ArtworkOfferLock, OfferLockOutcome } from "@auction/artwork-register-contracts";
import type { ILotRegisterLinkReader, LotRegisterLink } from "@auction/persistence/interfaces";
import type pino from "pino";
import type { BidOfferLockApplier, BidOfferLockEvent } from "./artwork-offer-lock.types.js";
import type { ProjectorRunContext } from "./lib/projector.types.js";

export const ARTWORK_OFFER_LOCK_PROJECTOR = "artwork_offer_lock";

/** Events that can end a lot's offer on LAX Bid, and the payment that completes its sale. */
export const ARTWORK_OFFER_LOCK_EVENT_TYPES = [
  "lot.unpublished",
  "lot.cancelled",
  "lot.voided",
  "lot.ended",
  "lot.returned_to_inventory",
  "payment.captured",
] as const;

type LotEvent = BidOfferLockEvent;

export type BidOfferMove =
  | { kind: "withdraw"; lotId: string }
  | { kind: "sold"; lotId: string }
  | null;

/** The lot an event is about: the aggregate for lot events, the payment's lot for a capture. */
function lotIdOf(event: LotEvent): string | null {
  const id =
    event.eventType === "payment.captured"
      ? (event.payload as { lotId?: unknown } | null)?.lotId
      : event.aggregateId;
  return typeof id === "string" ? id : null;
}

/**
 * What an event means for the register. A lot that is draft, cancelled, voided or ended with no
 * winner is not offered; one that is scheduled, live or won stays offered. The lot's current state
 * decides, not the event's age, so events replayed out of step (a lot published again after being
 * unpublished) never withdraw a live offer. A captured payment completes the sale.
 */
export function bidOfferMove(event: LotEvent, link: LotRegisterLink | null): BidOfferMove {
  const lotId = lotIdOf(event);
  if (!lotId || !link) return null;
  if (event.eventType === "payment.captured") return { kind: "sold", lotId };
  const withdrawn =
    link.status === "draft" ||
    link.status === "cancelled" ||
    link.status === "voided" ||
    (link.status === "ended" && !link.hasWinner);
  return withdrawn ? { kind: "withdraw", lotId } : null;
}

/** Applies a Bid lot event to the artwork register through the one-place-at-a-time lock. */
export class BidOfferLockRecorder implements BidOfferLockApplier {
  constructor(
    private readonly lock: ArtworkOfferLock,
    private readonly links: ILotRegisterLinkReader,
  ) {}

  async apply(event: LotEvent): Promise<OfferLockOutcome | { status: "ignored" }> {
    const lotId = lotIdOf(event);
    if (!lotId) return { status: "ignored" };
    const link = await this.links.findLink(lotId);
    const move = bidOfferMove(event, link);
    if (!link || !move) return { status: "ignored" };
    const registerLink = { registerId: link.registerId };
    const ref = { kind: "bid_lot", id: move.lotId } as const;
    return move.kind === "sold"
      ? this.lock.markSold(registerLink, ref, "system")
      : this.lock.withdraw(registerLink, ref, "system");
  }
}

export async function processArtworkOfferLock(options: {
  ctx: ProjectorRunContext;
  log: pino.Logger;
  recorder: BidOfferLockApplier;
}): Promise<void> {
  const { ctx, log, recorder } = options;
  const { projectorStateRepo, domainEventReader, projectorFailureRecorder } = ctx;
  const cursor = await projectorStateRepo.getCursor(ARTWORK_OFFER_LOCK_PROJECTOR);
  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: [...ARTWORK_OFFER_LOCK_EVENT_TYPES],
    limit: 50,
  });
  if (rows.length === 0) return;

  let maxId = cursor;
  for (const row of rows) {
    try {
      const outcome = await recorder.apply(row);
      if (outcome.status === "skipped") {
        log.warn(
          { eventId: row.id, reason: outcome.reason, registerId: outcome.entry.id },
          "artwork_offer_lock_skipped",
        );
      }
      maxId = row.id;
    } catch (err) {
      const failure = await projectorFailureRecorder.record({
        log,
        projectorName: ARTWORK_OFFER_LOCK_PROJECTOR,
        eventId: row.id,
        err,
      });
      if (failure.action === "skip") {
        maxId = row.id;
        continue;
      }
      break;
    }
  }
  if (maxId > cursor) {
    await projectorStateRepo.advanceCursor(ARTWORK_OFFER_LOCK_PROJECTOR, maxId);
  }
}
