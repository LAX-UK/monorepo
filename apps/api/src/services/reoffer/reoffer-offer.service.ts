import {
  DEFAULT_OFFER_DAYS,
  capReached,
  isValidOfferDays,
  offerEndsAt,
  reofferSendBlock,
  transitionReoffer,
} from "@auction/domain";
import type {
  ILotReofferRepository,
  IReofferWorkflowReader,
  ISellerConsentRepository,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import { LotReofferConflictError } from "@auction/persistence/interfaces";
import { BUYER_DEFAULT_ACCESS, userHasAccessTo } from "@auction/types";
import type { ILotLifecycleRecorder } from "../interfaces/lot-lifecycle-recorder.js";
import type { ReofferStaffActor } from "./reoffer-actors.js";
import { ReofferError } from "./reoffer-errors.js";
import { reofferEventBase } from "./reoffer-events.js";
import { lockLotAndOffer, recordedLot } from "./reoffer-lock.js";
import type {
  IReofferArtworkPlaceGuard,
  IReofferAtgGuard,
  IReofferMoneyPauseGuard,
} from "./reoffer-ports.js";

export type ReofferOfferServiceDeps = {
  transactionRunner: ITransactionRunner;
  workflow: IReofferWorkflowReader;
  offers: ILotReofferRepository;
  consents: Pick<ISellerConsentRepository, "findForReoffer">;
  recorder: Pick<ILotLifecycleRecorder, "recordReoffer">;
  atg: IReofferAtgGuard;
  place: IReofferArtworkPlaceGuard;
  /** The Zoho sold-while-live guard hook (`reoffer_send`). */
  moneyPause: IReofferMoneyPauseGuard;
  now?: () => Date;
};

export type SendOfferResult = { reofferId: string; offerSentAt: Date; offerEndsAt: Date };

const REASON_MAX = 1000;

/**
 * Staff send the offer to the bidder once the seller has agreed (RA6, RA8, RA9) or withdraw it
 * while it is still open. Sending is the last thing that can stop the money moving the wrong way,
 * so it re-checks, under the lot's row lock, everything the re-award will check again.
 */
export class ReofferOfferService {
  private readonly now: () => Date;

  constructor(private readonly deps: ReofferOfferServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /** `days`: the window in days, 1 to 7 (RA8, RA9); three when staff do not choose. */
  async send(
    actor: ReofferStaffActor,
    reofferId: string,
    input: { days?: number | undefined } = {},
  ): Promise<SendOfferResult> {
    this.requireDefaultAccess(actor);
    const days = input.days ?? DEFAULT_OFFER_DAYS;
    if (!isValidOfferDays(days)) {
      throw new ReofferError("invalid_offer_days", "An offer lasts 1 to 7 days.");
    }
    return this.inTransaction((tx) => this.sendLocked(tx, actor, reofferId, days));
  }

  async withdraw(
    actor: ReofferStaffActor,
    reofferId: string,
    input: { reason: string },
  ): Promise<{ reofferId: string }> {
    this.requireDefaultAccess(actor);
    const reason = input.reason.trim();
    if (reason.length === 0 || reason.length > REASON_MAX) {
      throw new ReofferError("note_required", "Say why the offer is being withdrawn.");
    }
    return this.inTransaction((tx) => this.withdrawLocked(tx, actor, reofferId, reason));
  }

  private requireDefaultAccess(actor: ReofferStaffActor): void {
    if (!userHasAccessTo(actor.role, actor.staffRoles, BUYER_DEFAULT_ACCESS)) {
      throw new ReofferError("forbidden", "You do not have permission to change an offer.");
    }
  }

  private async inTransaction<T>(
    fn: (tx: Parameters<IReofferWorkflowReader["lockLot"]>[0]) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.deps.transactionRunner.runInTransaction(fn);
    } catch (error) {
      if (error instanceof LotReofferConflictError) {
        throw new ReofferError("conflict", error.message);
      }
      throw error;
    }
  }

  private async sendLocked(
    tx: Parameters<IReofferWorkflowReader["lockLot"]>[0],
    actor: ReofferStaffActor,
    reofferId: string,
    days: number,
  ): Promise<SendOfferResult> {
    const { workflow, offers } = this.deps;
    const { lot, offer } = await lockLotAndOffer(tx, workflow, reofferId);

    const move = transitionReoffer(offer.status, "offer_sent", "staff");
    if (!move.ok) {
      throw new ReofferError(
        "offer_not_ready",
        "This offer can only be sent once the seller has agreed.",
      );
    }
    // `ready` is reached only by the seller's yes or a house-stock lot; check the record anyway.
    const consent = await this.deps.consents.findForReoffer(offer.id);
    if (!consent || (consent.status !== "given" && consent.status !== "not_needed")) {
      throw new ReofferError("consent_not_given", "The seller has not agreed to this offer.");
    }

    if (await this.deps.atg.soldOnAtg(lot.id)) {
      throw new ReofferError("sold_on_atg", "Sold on ATG: follow the ATG settlement runbook.");
    }
    const others = await workflow.otherOffers(tx, offer.buyerDefaultId, offer.id);
    if (capReached(others)) {
      throw new ReofferError(
        "offer_limit_reached",
        "Three offers have been made. Return the lot to inventory.",
      );
    }
    const latest = await workflow.latestDefault(tx, lot.id);
    const block = reofferSendBlock({
      lot: { status: lot.status, winnerId: lot.winnerId },
      latestDefaultId: latest?.id ?? null,
      offerDefaultId: offer.buyerDefaultId,
      payments: await workflow.paymentStatuses(tx, lot.id),
      otherOffers: others,
    });
    if (block) throw new ReofferError(block.code, block.message);

    // The price is the bidder's own placed bid and the bidder can still be offered it.
    const bids = await workflow.placedBids(tx, lot.id);
    const source = bids.find((bid) => bid.bidId === offer.sourceBidId);
    if (
      !source ||
      source.userId !== offer.offeredUserId ||
      source.legalEntityId !== offer.offeredLegalEntityId ||
      source.amountMinor !== offer.amountPence
    ) {
      throw new ReofferError(
        "offer_bid_mismatch",
        "The offer no longer matches the bid it was made from.",
      );
    }
    if (source.accountState !== "active") {
      throw new ReofferError(
        "bidder_unavailable",
        "The bidder's account can no longer receive this offer.",
      );
    }

    // Gallery sale wins (IC6/Q7), then the Zoho pause guard: both refuse before anything is written.
    const place = await this.deps.place.check(lot.id);
    if (!place.ok) throw new ReofferError("artwork_offered_elsewhere", place.message);
    await this.deps.moneyPause.assertNotPaused("reoffer_send", { lotId: lot.id, reofferId });

    const sentAt = this.now();
    const endsAt = offerEndsAt(sentAt, days);
    await offers.changeStatus(tx, {
      id: offer.id,
      from: "ready",
      to: move.status,
      offerSentAt: sentAt,
      offerEndsAt: endsAt,
    });
    await this.deps.recorder.recordReoffer(
      tx,
      recordedLot(lot),
      "lot.reoffer_sent",
      { ...reofferEventBase(offer, "staff"), offerEndsAt: endsAt.toISOString() },
      actor.userId,
    );
    return { reofferId: offer.id, offerSentAt: sentAt, offerEndsAt: endsAt };
  }

  private async withdrawLocked(
    tx: Parameters<IReofferWorkflowReader["lockLot"]>[0],
    actor: ReofferStaffActor,
    reofferId: string,
    reason: string,
  ): Promise<{ reofferId: string }> {
    const { lot, offer } = await lockLotAndOffer(tx, this.deps.workflow, reofferId);
    const move = transitionReoffer(offer.status, "withdrawn", "staff");
    if (!move.ok) {
      throw new ReofferError(
        "offer_not_open",
        "This offer is no longer open, so it cannot be withdrawn.",
      );
    }
    await this.deps.offers.changeStatus(tx, {
      id: offer.id,
      from: offer.status,
      to: move.status,
      closedBy: actor.userId,
      closeReason: reason,
    });
    await this.deps.recorder.recordReoffer(
      tx,
      recordedLot(lot),
      "lot.reoffer_withdrawn",
      { ...reofferEventBase(offer, "staff"), reason },
      actor.userId,
    );
    return { reofferId: offer.id };
  }
}
