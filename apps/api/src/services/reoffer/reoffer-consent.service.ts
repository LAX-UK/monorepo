import {
  type ReofferActor,
  answerConsent,
  canReopenLapsedRequest,
  entityActorCan,
  reofferSendBlock,
  transitionReoffer,
} from "@auction/domain";
import type {
  ILotReofferRepository,
  IReofferWorkflowReader,
  ISellerConsentRepository,
  ITransactionRunner,
  SellerPreferredNext,
} from "@auction/persistence/interfaces";
import { LotReofferConflictError } from "@auction/persistence/interfaces";
import { userHasAccessTo } from "@auction/types";
import type { ILotLifecycleRecorder } from "../interfaces/lot-lifecycle-recorder.js";
import type { ReofferMemberActor, ReofferStaffActor } from "./reoffer-actors.js";
import { ReofferError } from "./reoffer-errors.js";
import { reofferEventBase } from "./reoffer-events.js";
import { lockLotAndOffer, recordedLot } from "./reoffer-lock.js";

export type SellerAnswerInput = {
  answer: "given" | "refused";
  /** What the seller said and how: required whenever staff record the answer for the seller. */
  note?: string | null | undefined;
  /** What a refusing seller wants done with the lot. */
  preferredNext?: SellerPreferredNext | null | undefined;
};

export type SellerAnswerResult = {
  reofferId: string;
  consentStatus: "given" | "refused";
  offerStatus: "ready" | "seller_declined";
};

export type ReofferConsentServiceDeps = {
  transactionRunner: ITransactionRunner;
  workflow: IReofferWorkflowReader;
  offers: ILotReofferRepository;
  consents: ISellerConsentRepository;
  recorder: Pick<ILotLifecycleRecorder, "recordReoffer">;
  now?: () => Date;
};

const NOTE_MAX = 1000;

type Answerer =
  | { kind: "staff"; userId: string }
  | { kind: "seller"; userId: string; sellerLegalEntityId: string };

/**
 * The seller's answer to a request to sell at the underbidder's price (RA2, RA3, RA5). It arrives
 * from the seller's workspace, or staff record what the seller told them (the note says what and
 * how). Once answered it is never answered again; silence is never a yes. Only staff can record a
 * late answer on a request that lapsed, and only while no later offer exists.
 */
export class ReofferConsentService {
  private readonly now: () => Date;

  constructor(private readonly deps: ReofferConsentServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /** Staff record the seller's answer (`auction.manage`). */
  async recordForSeller(
    actor: ReofferStaffActor,
    reofferId: string,
    input: SellerAnswerInput,
  ): Promise<SellerAnswerResult> {
    if (!userHasAccessTo(actor.role, actor.staffRoles, "auction.manage")) {
      throw new ReofferError(
        "forbidden",
        "You do not have permission to record a seller's answer.",
      );
    }
    const note = (input.note ?? "").trim();
    if (note.length === 0) {
      throw new ReofferError(
        "note_required",
        "Say what the seller told you and how, so the answer can be checked later.",
      );
    }
    return this.apply({ kind: "staff", userId: actor.userId }, reofferId, { ...input, note });
  }

  /** A member of the seller's account answers from their workspace. */
  async answerInWorkspace(
    actor: ReofferMemberActor,
    reofferId: string,
    input: SellerAnswerInput,
  ): Promise<SellerAnswerResult> {
    // Agreeing to sell below the hammer changes the account's terms of sale: the people who run it.
    if (
      !entityActorCan(
        { role: actor.role, isImpersonation: actor.isImpersonation },
        "entity.consignments.after_sale",
      )
    ) {
      throw new ReofferError("forbidden", "Your role in this account can't answer this request.");
    }
    const note = (input.note ?? "").trim();
    return this.apply(
      { kind: "seller", userId: actor.userId, sellerLegalEntityId: actor.legalEntityId },
      reofferId,
      { ...input, note: note.length > 0 ? note : null },
    );
  }

  private async apply(
    who: Answerer,
    reofferId: string,
    input: SellerAnswerInput,
  ): Promise<SellerAnswerResult> {
    if ((input.note ?? "").length > NOTE_MAX) {
      throw new ReofferError("note_required", `Keep the note to ${NOTE_MAX} characters.`);
    }
    try {
      return await this.deps.transactionRunner.runInTransaction((tx) =>
        this.applyLocked(tx, who, reofferId, input),
      );
    } catch (error) {
      if (error instanceof LotReofferConflictError) {
        throw new ReofferError("conflict", error.message);
      }
      throw error;
    }
  }

  private async applyLocked(
    tx: Parameters<IReofferWorkflowReader["lockLot"]>[0],
    who: Answerer,
    reofferId: string,
    input: SellerAnswerInput,
  ): Promise<SellerAnswerResult> {
    const { workflow, offers, consents } = this.deps;
    const { lot, offer } = await lockLotAndOffer(tx, workflow, reofferId);
    // A seller sees only their own account's requests: another account's is simply not there.
    if (who.kind === "seller" && lot.sellerLegalEntityId !== who.sellerLegalEntityId) {
      throw new ReofferError("offer_not_found", "This request does not exist.");
    }
    const consent = await consents.findForReoffer(offer.id);
    if (!consent) throw new ReofferError("offer_not_found", "This request does not exist.");

    const now = this.now();
    const actor: ReofferActor = who.kind === "staff" ? "staff" : "seller";
    const answered = answerConsent(consent.status, input.answer, actor);
    if (!answered.ok) {
      throw new ReofferError(
        answered.reason === "already_answered"
          ? "consent_already_answered"
          : answered.reason === "not_requested"
            ? "consent_not_requested"
            : "consent_not_allowed",
        answered.reason === "already_answered"
          ? "This request has already been answered."
          : answered.reason === "not_requested"
            ? "This lot needs no answer from the seller."
            : "This answer cannot be recorded now.",
      );
    }
    // The clock lapses a request at its deadline; until it has run, a seller who is late still
    // may not answer from the workspace, but staff can record what they were told.
    if (
      who.kind === "seller" &&
      consent.dueAt !== null &&
      now.getTime() >= consent.dueAt.getTime()
    ) {
      throw new ReofferError(
        "consent_window_ended",
        "The time to answer this request has ended. Please contact us.",
      );
    }
    const move = transitionReoffer(offer.status, answered.reofferEvent, actor);
    if (!move.ok) {
      throw new ReofferError("offer_not_open", "This offer has been withdrawn or has moved on.");
    }

    const records = await offers.recordsForDefault(tx, offer.buyerDefaultId);
    if (offer.status === "seller_lapsed" && !canReopenLapsedRequest(records)) {
      throw new ReofferError(
        "lapsed_request_closed",
        "A later offer exists for this lot, so this request can no longer be reopened.",
      );
    }
    if (input.answer === "given") {
      // An answer of yes makes the offer ready to send, so the lot must still be waiting for a buyer.
      const latest = await workflow.latestDefault(tx, lot.id);
      const block = reofferSendBlock({
        lot: { status: lot.status, winnerId: lot.winnerId },
        latestDefaultId: latest?.id ?? null,
        offerDefaultId: offer.buyerDefaultId,
        payments: await workflow.paymentStatuses(tx, lot.id),
        otherOffers: records,
      });
      if (block) throw new ReofferError(block.code, block.message);
    }

    const channel = who.kind === "staff" ? "recorded_by_staff" : "workspace";
    await consents.answer(tx, {
      id: consent.id,
      from: consent.status,
      to: answered.status as "given" | "refused",
      channel,
      answeredByUserId: who.userId,
      answeredAt: now,
      note: input.note ?? null,
      preferredNext: input.answer === "refused" ? (input.preferredNext ?? null) : null,
    });
    await offers.changeStatus(tx, {
      id: offer.id,
      from: offer.status,
      to: move.status,
      ...(input.answer === "refused"
        ? { closedBy: who.userId, closeReason: "seller_declined" }
        : {}),
    });

    const lotRow = recordedLot(lot);
    const base = reofferEventBase(offer, actor);
    if (input.answer === "given") {
      await this.deps.recorder.recordReoffer(
        tx,
        lotRow,
        "lot.seller_consent_given",
        { ...base, channel },
        who.userId,
      );
    } else {
      await this.deps.recorder.recordReoffer(
        tx,
        lotRow,
        "lot.seller_consent_refused",
        { ...base, channel, preferredNext: input.preferredNext ?? null },
        who.userId,
      );
    }
    return {
      reofferId: offer.id,
      consentStatus: input.answer,
      offerStatus: move.status as "ready" | "seller_declined",
    };
  }
}
