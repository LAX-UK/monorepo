import {
  type ArtworkOfferLock,
  ArtworkOfferMoveError,
  ArtworkOfferedElsewhereError,
  type RegisterLink,
} from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import type { ILotRegisterLinkReader } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import { LotError } from "../lib/errors.js";
import type { LotLifecycleEventRecorder } from "./lot-lifecycle-event-recorder.js";
import { LotLifecycleRecording } from "./lot-lifecycle-recording.service.js";

type LotRow = Pick<Lot, "id" | "status" | "saleId" | "sellerLegalEntityId">;

/**
 * Publishing a lot is where an artwork is offered on LAX Bid. Every publish path (a single lot, a
 * sale, an emergency add) records `lot.published` inside its transaction, so asking the register
 * here covers them all: when the artwork is offered elsewhere the error rolls the publish back
 * with a message staff can act on. A lot with no register link publishes exactly as before.
 *
 * The moves that end an offer (unpublish, cancel, end, payment) are recorded by the worker from
 * the lot's events, so they also cover lots closed outside this process.
 */
export class OfferLockLotLifecycleRecording extends LotLifecycleRecording {
  constructor(
    recorder: LotLifecycleEventRecorder,
    private readonly offerLock: ArtworkOfferLock,
    private readonly links: ILotRegisterLinkReader,
  ) {
    super(recorder);
  }

  override async recordPublished(
    tx: Database,
    lotRow: LotRow,
    actorUserId?: string | null,
  ): Promise<void> {
    await super.recordPublished(tx, lotRow, actorUserId);
    const found = await this.links.findLink(lotRow.id);
    if (!found) return;
    const link: RegisterLink = { registerId: found.registerId };
    try {
      await this.offerLock.offer(
        link,
        { kind: "bid_lot", id: lotRow.id },
        actorUserId ? `staff:${actorUserId}` : "system",
      );
    } catch (error) {
      if (error instanceof ArtworkOfferedElsewhereError || error instanceof ArtworkOfferMoveError) {
        throw new LotError(error.message, 409, error.code);
      }
      throw error;
    }
  }
}
