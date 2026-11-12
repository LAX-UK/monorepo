import {
  answerConsent,
  offerStep,
  reofferSendBlock,
  sellerRequestStep,
  transitionReoffer,
} from "@auction/domain";
import type {
  ILotReofferRepository,
  IReofferSweepReader,
  IReofferWorkflowReader,
  ISellerConsentRepository,
  ITransactionRunner,
  ReofferSweepRef,
} from "@auction/persistence/interfaces";
import { LotReofferConflictError } from "@auction/persistence/interfaces";
import { lockReofferLotThenOffer } from "@auction/persistence/lib";
import type { IReofferClockEvents, IReofferNotices } from "./reoffer-clock-ports.js";

export type SellerRequestOutcome = "lapsed" | "reminded" | "waiting" | "skipped";
export type OfferOutcome = "ended" | "reminded" | "waiting" | "skipped";

export type ReofferClockServiceDeps = {
  transactionRunner: ITransactionRunner;
  workflow: IReofferWorkflowReader;
  offers: Pick<ILotReofferRepository, "changeStatus">;
  consents: Pick<ISellerConsentRepository, "findForReoffer" | "answer" | "markReminded">;
  /** Which buyer default is the lot's latest (the clock may not read more of a default). */
  defaults: Pick<IReofferSweepReader, "latestDefaultId">;
  events: IReofferClockEvents;
  notices: IReofferNotices;
  now?: () => Date;
};

/**
 * What the clock does with seller requests and offers: lapses a request nobody answered, ends an
 * offer the bidder let run out, and sends each reminder once. Every step takes the lot's lock and
 * then the offer's, the order the API uses, re-reads the offer under them and decides from what it
 * finds, so it never acts on a stale listing, never races an answer, and a repeat is a no-op.
 *
 * It only closes. It never makes anyone a buyer, never changes an amount or a lot, and never
 * touches a payment: the lot changes through the re-award, which only an accepted offer reaches.
 */
export class ReofferClockService {
  private readonly now: () => Date;

  constructor(private readonly deps: ReofferClockServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async settleSellerRequest(ref: ReofferSweepRef): Promise<SellerRequestOutcome> {
    return this.inTransaction("skipped", async (tx) => {
      const { workflow, offers, consents, events, notices } = this.deps;
      const locked = await lockReofferLotThenOffer(tx, workflow, ref.reofferId);
      if (!locked.ok) return "skipped";
      const { lot, offer } = locked;
      const consent = await consents.findForReoffer(offer.id, tx);
      if (!consent) return "skipped";
      const now = this.now();
      const step = sellerRequestStep(
        {
          offerStatus: offer.status,
          consentStatus: consent.status,
          requestedAt: consent.requestedAt,
          dueAt: consent.dueAt,
          remindedAt: consent.remindedAt,
        },
        now,
      );
      if (step === "none") return "waiting";

      if (step === "remind") {
        // Claim the reminder and queue its notice together: either both happen or neither does.
        if (!(await consents.markReminded(consent.id, now, tx))) return "skipped";
        await notices.sellerReminder(
          tx,
          { offer, lot, at: consent.dueAt as Date, now },
          consent.sellerLegalEntityId,
        );
        return "reminded";
      }

      // Silence is never a yes: the request lapses, and staff can still record a late answer.
      const answered = answerConsent(consent.status, "lapsed", "clock");
      const move = transitionReoffer(offer.status, "seller_lapsed", "clock");
      if (!answered.ok || !move.ok) return "skipped";
      await consents.answer(tx, {
        id: consent.id,
        from: consent.status,
        to: "lapsed",
        channel: null,
        answeredByUserId: null,
        answeredAt: now,
        note: null,
        preferredNext: null,
      });
      await offers.changeStatus(tx, {
        id: offer.id,
        from: offer.status,
        to: move.status,
        closeReason: "seller_lapsed",
      });
      await events.record(tx, lot, "lot.seller_consent_lapsed", offer);
      return "lapsed";
    });
  }

  async settleOffer(ref: ReofferSweepRef): Promise<OfferOutcome> {
    return this.inTransaction("skipped", async (tx) => {
      const { workflow, offers, consents, defaults, events, notices } = this.deps;
      const locked = await lockReofferLotThenOffer(tx, workflow, ref.reofferId);
      if (!locked.ok) return "skipped";
      const { lot, offer } = locked;
      const now = this.now();
      const step = offerStep(offer, now);
      if (step === "none") return "waiting";
      const endsAt = offer.offerEndsAt as Date;

      if (step === "remind") {
        // An offer that can no longer be won is not worth a reminder: accepting would be refused.
        const latestDefaultId = await defaults.latestDefaultId(tx, lot.id);
        const block = reofferSendBlock({
          lot: { status: lot.status, winnerId: lot.winnerId },
          latestDefaultId,
          offerDefaultId: offer.buyerDefaultId,
          payments: await workflow.paymentStatuses(tx, lot.id),
          otherOffers: await workflow.otherOffers(tx, offer.buyerDefaultId, offer.id),
        });
        if (block) return "waiting";
        await notices.offerReminder(tx, { offer, lot, at: endsAt, now });
        return "reminded";
      }

      const move = transitionReoffer(offer.status, "offer_ended", "clock");
      if (!move.ok) return "skipped";
      const consent = await consents.findForReoffer(offer.id, tx);
      await offers.changeStatus(tx, {
        id: offer.id,
        from: offer.status,
        to: move.status,
        closeReason: "offer_ended",
      });
      await events.record(tx, lot, "lot.reoffer_expired", offer);
      await notices.offerEnded(
        tx,
        { offer, lot, at: endsAt, now },
        lot.sellerLegalEntityId !== null && consent
          ? { legalEntityId: lot.sellerLegalEntityId, agreed: consent.status === "given" }
          : null,
      );
      return "ended";
    });
  }

  private async inTransaction<T>(
    onConflict: T,
    fn: (tx: Parameters<IReofferWorkflowReader["lockLot"]>[0]) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.deps.transactionRunner.runInTransaction(fn);
    } catch (error) {
      // Someone moved the offer between our read and our write: theirs stands, ours is dropped.
      if (error instanceof LotReofferConflictError) return onConflict;
      throw error;
    }
  }
}
