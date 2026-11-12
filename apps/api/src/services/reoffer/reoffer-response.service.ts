import {
  entityActorCan,
  invoiceDueAfterAcceptance,
  reofferResponseBlock,
  transitionReoffer,
} from "@auction/domain";
import type {
  ILotReawardRepository,
  ILotReofferRepository,
  IReofferWorkflowReader,
  ISellerConsentRepository,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import { LotReawardRefusedError, LotReofferConflictError } from "@auction/persistence/interfaces";
import type { ILotLifecycleRecorder } from "../interfaces/lot-lifecycle-recorder.js";
import type { ReofferMemberActor } from "./reoffer-actors.js";
import { ReofferError, type ReofferErrorCode, isReofferErrorCode } from "./reoffer-errors.js";
import { reofferEventBase } from "./reoffer-events.js";
import { lockLotAndOffer, recordedLot } from "./reoffer-lock.js";
import type {
  IReofferArtworkPlaceGuard,
  IReofferAtgGuard,
  IReofferInvoicing,
  IReofferMoneyPauseGuard,
  IReofferPricing,
} from "./reoffer-ports.js";

export type ReofferResponseServiceDeps = {
  transactionRunner: ITransactionRunner;
  workflow: IReofferWorkflowReader;
  offers: ILotReofferRepository;
  consents: Pick<ISellerConsentRepository, "findForReoffer">;
  reaward: ILotReawardRepository;
  recorder: Pick<ILotLifecycleRecorder, "recordReoffer">;
  atg: IReofferAtgGuard;
  place: IReofferArtworkPlaceGuard;
  /** The Zoho sold-while-live guard hook (`reoffer_accept`). */
  moneyPause: IReofferMoneyPauseGuard;
  invoicing: IReofferInvoicing;
  /** The invoice's pricing, the same the bidder's page is drawn from. */
  pricing: IReofferPricing;
  now?: () => Date;
};

export type AcceptOfferResult = {
  reofferId: string;
  lotId: string;
  amountPence: number;
  acceptedAt: Date;
  /** When the invoice that follows falls due: seven days, counted from the day of acceptance. */
  invoiceDueAt: Date;
};

const DECLINE_REASON_MAX = 500;

/** Why the re-award refused, in words the buyer can read; the codes are the domain's. */
function refusalCode(code: string): ReofferErrorCode {
  return isReofferErrorCode(code) ? code : "conflict";
}

/**
 * The bidder's answer to an offer, from their workspace (RA10, RA11). Accepting is binding and
 * needs the terms box ticked; it is a signed-in POST and nothing else: no link in an email can
 * accept. Accepting and re-awarding are one transaction under the lot's row lock, so the lot is
 * never half-awarded, a payment that has landed stops it, and two answers cannot both win.
 */
export class ReofferResponseService {
  private readonly now: () => Date;

  constructor(private readonly deps: ReofferResponseServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async accept(
    actor: ReofferMemberActor,
    reofferId: string,
    input: { termsAccepted: boolean; expectedTotalMinor: number },
  ): Promise<AcceptOfferResult> {
    this.requireMayAnswer(actor);
    if (input.termsAccepted !== true) {
      throw new ReofferError(
        "terms_not_accepted",
        "Tick the box to confirm you accept the terms of this purchase.",
      );
    }
    const result = await this.inTransaction((tx) =>
      this.acceptLocked(tx, actor, reofferId, input.expectedTotalMinor),
    );
    // A repeat accept by the same account (a double click or a retry) is answered with the
    // original result; the award and invoice were handled by the first one.
    if (result.alreadyAccepted) return result.accepted;
    // The re-award is committed; the invoice follows and the backfill covers a failure here.
    try {
      await this.deps.invoicing.raiseFor(result.accepted.lotId);
    } catch (error) {
      console.error(
        "[ReofferResponseService] raising the invoice failed",
        result.accepted.lotId,
        error,
      );
    }
    return result.accepted;
  }

  async decline(
    actor: ReofferMemberActor,
    reofferId: string,
    input: { reason?: string | null | undefined },
  ): Promise<{ reofferId: string }> {
    this.requireMayAnswer(actor);
    const reason = (input.reason ?? "").trim();
    if (reason.length > DECLINE_REASON_MAX) {
      throw new ReofferError(
        "note_required",
        `Keep the reason to ${DECLINE_REASON_MAX} characters.`,
      );
    }
    return this.inTransaction((tx) =>
      this.declineLocked(tx, actor, reofferId, reason.length > 0 ? reason : null),
    );
  }

  /** Accepting binds the account to a purchase, so it is for the people who may bid for it. */
  private requireMayAnswer(actor: ReofferMemberActor): void {
    const member = { role: actor.role, isImpersonation: actor.isImpersonation };
    if (!entityActorCan(member, "entity.bid.place")) {
      throw new ReofferError("forbidden", "Your role in this account can't answer this offer.");
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
      if (error instanceof LotReawardRefusedError) {
        throw new ReofferError(refusalCode(error.code), error.message);
      }
      throw error;
    }
  }

  /** The offer for this account, or nothing: another account's offer is simply not there. */
  private async lockOwn(
    tx: Parameters<IReofferWorkflowReader["lockLot"]>[0],
    actor: ReofferMemberActor,
    reofferId: string,
  ) {
    const locked = await lockLotAndOffer(tx, this.deps.workflow, reofferId);
    if (locked.offer.offeredLegalEntityId !== actor.legalEntityId) {
      throw new ReofferError("offer_not_found", "This offer does not exist.");
    }
    return locked;
  }

  private async acceptLocked(
    tx: Parameters<IReofferWorkflowReader["lockLot"]>[0],
    actor: ReofferMemberActor,
    reofferId: string,
    expectedTotalMinor: number,
  ): Promise<{ accepted: AcceptOfferResult; alreadyAccepted: boolean }> {
    const { lot, offer } = await this.lockOwn(tx, actor, reofferId);
    const now = this.now();
    // lockOwn has already limited this to the offered account, so another account never gets here.
    // Only while that award still stands: a later default that took the lot back makes it history.
    if (offer.status === "accepted" && offer.respondedAt && lot.winnerId === offer.offeredUserId) {
      return {
        alreadyAccepted: true,
        accepted: {
          reofferId: offer.id,
          lotId: lot.id,
          amountPence: offer.amountPence,
          acceptedAt: offer.respondedAt,
          invoiceDueAt: invoiceDueAfterAcceptance(offer.respondedAt),
        },
      };
    }
    const closed = reofferResponseBlock(offer, now);
    if (closed) throw new ReofferError(closed.code, closed.message);
    const move = transitionReoffer(offer.status, "bidder_accepted", "bidder");
    if (!move.ok) throw new ReofferError("offer_not_open", "This offer is no longer open.");
    const consent = await this.deps.consents.findForReoffer(offer.id);
    if (!consent || (consent.status !== "given" && consent.status !== "not_needed")) {
      throw new ReofferError("consent_not_given", "This offer cannot be accepted.");
    }

    // The bidder's account must still be able to buy (as at send): not restricted, suspended or closed.
    const bids = await this.deps.workflow.placedBids(tx, lot.id);
    const source = bids.find((bid) => bid.bidId === offer.sourceBidId);
    if (
      !source ||
      source.legalEntityId !== offer.offeredLegalEntityId ||
      source.accountState !== "active"
    ) {
      throw new ReofferError(
        "bidder_unavailable",
        "This account can no longer accept this offer. Contact us if you think this is wrong.",
      );
    }

    if (await this.deps.atg.soldOnAtg(lot.id)) {
      throw new ReofferError("sold_on_atg", "This lot was sold elsewhere.");
    }
    const place = await this.deps.place.check(lot.id);
    if (!place.ok) throw new ReofferError("artwork_offered_elsewhere", place.message);
    await this.deps.moneyPause.assertNotPaused("reoffer_accept", { lotId: lot.id, reofferId });

    // The bidder agrees to the total the page showed. Priced again here, under the lot lock and
    // after every other check, so a premium changed since the page loaded is refused with
    // nothing changed rather than invoiced at a total the bidder never saw.
    const priced = await this.deps.pricing.priceFor({
      lotId: lot.id,
      buyerLegalEntityId: offer.offeredLegalEntityId,
      hammerPence: offer.amountPence,
    });
    if (priced.totalPence !== expectedTotalMinor) {
      throw new ReofferError(
        "price_changed",
        "The total for this lot has changed since you opened this page. Check the new total and accept again if you still wish to buy.",
      );
    }

    await this.deps.offers.changeStatus(tx, {
      id: offer.id,
      from: "offered",
      to: move.status,
      respondedAt: now,
    });
    // The money rule lives in the re-award: under the lot lock it refuses a lot with a payment
    // that is paid, being paid or held, a lot another offer already won, or a later default.
    // Any refusal rolls the acceptance back with it.
    const reawarded = await this.deps.reaward.reaward(tx, { reofferId: offer.id });

    const lotRow = recordedLot(lot);
    const base = reofferEventBase(offer, "bidder");
    await this.deps.recorder.recordReoffer(tx, lotRow, "lot.reoffer_accepted", base, actor.userId);
    await this.deps.recorder.recordReoffer(
      tx,
      lotRow,
      "lot.reawarded",
      {
        ...base,
        reason: "reoffer_accepted",
        newBuyerId: reawarded.newBuyerId,
        newBuyerLegalEntityId: reawarded.newBuyerLegalEntityId,
        previousBuyerId: reawarded.previousBuyerId,
        originalHammerPence: reawarded.originalHammerPence,
      },
      actor.userId,
    );
    return {
      alreadyAccepted: false,
      accepted: {
        reofferId: offer.id,
        lotId: lot.id,
        amountPence: offer.amountPence,
        acceptedAt: now,
        invoiceDueAt: invoiceDueAfterAcceptance(now),
      },
    };
  }

  private async declineLocked(
    tx: Parameters<IReofferWorkflowReader["lockLot"]>[0],
    actor: ReofferMemberActor,
    reofferId: string,
    reason: string | null,
  ): Promise<{ reofferId: string }> {
    const { lot, offer } = await this.lockOwn(tx, actor, reofferId);
    const now = this.now();
    const closed = reofferResponseBlock(offer, now);
    if (closed) throw new ReofferError(closed.code, closed.message);
    const move = transitionReoffer(offer.status, "bidder_declined", "bidder");
    if (!move.ok) throw new ReofferError("offer_not_open", "This offer is no longer open.");
    await this.deps.offers.changeStatus(tx, {
      id: offer.id,
      from: "offered",
      to: move.status,
      respondedAt: now,
      declineReason: reason,
    });
    await this.deps.recorder.recordReoffer(
      tx,
      recordedLot(lot),
      "lot.reoffer_declined",
      { ...reofferEventBase(offer, "bidder"), reason },
      actor.userId,
    );
    return { reofferId: offer.id };
  }
}
