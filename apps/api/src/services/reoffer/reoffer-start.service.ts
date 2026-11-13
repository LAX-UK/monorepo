import {
  type OfferedParty,
  type SkippedBidder,
  consentRequirement,
  initialReofferStatus,
  reofferStartBlock,
  selectNextBidder,
  sellerConsentWindow,
} from "@auction/domain";
import type {
  ILotReofferRepository,
  IReofferWorkflowReader,
  ITransactionRunner,
  PlacedBidWithId,
} from "@auction/persistence/interfaces";
import { LotReofferConflictError } from "@auction/persistence/interfaces";
import { BUYER_DEFAULT_ACCESS, userHasAccessTo } from "@auction/types";
import type { ILotLifecycleRecorder } from "../interfaces/lot-lifecycle-recorder.js";
import type { ReofferStaffActor } from "./reoffer-actors.js";
import { ReofferError, type ReofferErrorCode } from "./reoffer-errors.js";
import { reofferEventBase } from "./reoffer-events.js";
import { recordedLot } from "./reoffer-lock.js";
import type {
  IReofferAtgGuard,
  IReofferLotOwnership,
  IReofferSellerProceeds,
} from "./reoffer-ports.js";

export type StartReofferInput = {
  /** The default the offer answers. Optional: the lot's latest default is used, and a stale id is refused. */
  buyerDefaultId?: string | undefined;
};

export type StartReofferResult = {
  reofferId: string;
  sequence: number;
  status: "awaiting_seller" | "ready";
  amountPence: number;
  consentStatus: "requested" | "not_needed";
  consentDueAt: Date | null;
  /** Bidders passed over on the way (suspended, closed, deletion pending), for staff. */
  skippedBidders: SkippedBidder[];
};

export type ReofferStartServiceDeps = {
  transactionRunner: ITransactionRunner;
  workflow: IReofferWorkflowReader;
  offers: ILotReofferRepository;
  recorder: Pick<ILotLifecycleRecorder, "recordReoffer">;
  atg: IReofferAtgGuard;
  proceeds: IReofferSellerProceeds;
  ownership: IReofferLotOwnership;
  now?: () => Date;
};

const NO_BIDDER_MESSAGES = {
  offer_limit_reached: "Three offers have been made. Return the lot to inventory.",
  no_other_bidder: "No other bidder placed a bid on this lot.",
  no_eligible_bidder:
    "Every other bidder's account is suspended, closed or being deleted, so there is nobody to offer the lot to.",
} as const;

function sameParty(a: PlacedBidWithId, b: OfferedParty & { amountMinor: number }): boolean {
  return (
    a.userId === b.userId && a.legalEntityId === b.legalEntityId && a.amountMinor === b.amountMinor
  );
}

/**
 * Starts an offer of a defaulted lot to the next bidder, at the amount that bidder bid and never
 * at a hidden maximum (RA6). Everything is decided in one transaction under the lot's row lock:
 * which bidder is next, how many offers there have been, whether anything on the lot has been
 * paid, so two staff starting at once make one offer, and nothing starts once money has moved.
 */
export class ReofferStartService {
  private readonly now: () => Date;

  constructor(private readonly deps: ReofferStartServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async start(
    actor: ReofferStaffActor,
    lotId: string,
    input: StartReofferInput = {},
  ): Promise<StartReofferResult> {
    if (!userHasAccessTo(actor.role, actor.staffRoles, BUYER_DEFAULT_ACCESS)) {
      throw new ReofferError("forbidden", "You do not have permission to offer a lot again.");
    }
    try {
      return await this.deps.transactionRunner.runInTransaction((tx) =>
        this.startLocked(tx, actor, lotId, input),
      );
    } catch (error) {
      if (error instanceof LotReofferConflictError) {
        throw new ReofferError("conflict", error.message);
      }
      throw error;
    }
  }

  private async startLocked(
    tx: Parameters<IReofferWorkflowReader["lockLot"]>[0],
    actor: ReofferStaffActor,
    lotId: string,
    input: StartReofferInput,
  ): Promise<StartReofferResult> {
    const { workflow, offers } = this.deps;
    const lot = await workflow.lockLot(tx, lotId);
    if (!lot || lot.deleted) throw new ReofferError("lot_not_found", "Lot not found.");

    const latest = await workflow.latestDefault(tx, lotId);
    if (latest && input.buyerDefaultId && input.buyerDefaultId !== latest.id) {
      throw new ReofferError(
        "default_not_latest",
        "The lot has defaulted again since this page was loaded. Reload and try again.",
      );
    }
    const records = latest ? await offers.recordsForDefault(tx, latest.id) : [];
    const block = reofferStartBlock({
      soldOnAtg: await this.deps.atg.soldOnAtg(lotId),
      // The lot must be waiting for a buyer: ended, with the defaulting buyer taken off.
      buyerDefaultRecorded: latest !== null && lot.status === "ended" && lot.winnerId === null,
      payments: await workflow.paymentStatuses(tx, lotId),
      offers: records,
    });
    if (block) throw new ReofferError(block.code, block.message);
    if (!latest || !lot.sellerLegalEntityId) {
      throw new ReofferError("buyer_default_not_recorded", "Record the buyer default first.");
    }

    const bids = await workflow.placedBids(tx, lotId);
    const next = selectNextBidder({
      bids,
      defaultingBuyer: { userId: latest.buyerId, legalEntityId: latest.buyerLegalEntityId },
      alreadyOffered: await workflow.priorOffers(tx, latest.id),
    });
    if (next.kind === "none") {
      throw new ReofferError(next.reason as ReofferErrorCode, NO_BIDDER_MESSAGES[next.reason]);
    }
    // The bid the offer points at: the bidder's own placed bid at that amount, the earliest.
    const sourceBid = bids.find((bid) => sameParty(bid, next.bidder));
    if (!sourceBid) throw new ReofferError("conflict", "The bid changed. Try again.");

    const sequence = records.length + 1;
    const now = this.now();
    const requirement = consentRequirement({
      ownership: await this.deps.ownership.of(lot.sellerLegalEntityId),
      offerMinor: next.bidder.amountMinor,
      reserveMinor: lot.reservePence,
    });
    const dueAt = requirement.status === "requested" ? sellerConsentWindow(now).dueAt : null;
    // What the seller is paid at each hammer: each priced for the buyer who would pay it.
    const sellerLegalEntityId = lot.sellerLegalEntityId;
    const atOffer = await this.deps.proceeds.proceedsFor({
      lotId,
      sellerLegalEntityId,
      buyerLegalEntityId: next.bidder.legalEntityId,
      hammerPence: next.bidder.amountMinor,
    });
    const atOriginal = await this.deps.proceeds.proceedsFor({
      lotId,
      sellerLegalEntityId,
      buyerLegalEntityId: latest.buyerLegalEntityId,
      hammerPence: latest.hammerPence,
    });
    const created = await offers.create(tx, {
      lotId,
      buyerDefaultId: latest.id,
      sequence,
      offeredUserId: next.bidder.userId,
      offeredLegalEntityId: next.bidder.legalEntityId,
      sourceBidId: sourceBid.bidId,
      amountPence: next.bidder.amountMinor,
      status: initialReofferStatus(requirement),
      sellerLegalEntityId: lot.sellerLegalEntityId,
      consent: {
        status: requirement.status,
        channel: requirement.status === "not_needed" ? "house_stock" : null,
        terms: {
          amountPence: next.bidder.amountMinor,
          originalHammerPence: latest.hammerPence,
          saleAtOfferPence: atOffer.salePence,
          proceedsAtOfferPence: atOffer.proceedsPence,
          proceedsAtOriginalPence: atOriginal.proceedsPence,
          reservePence: lot.reservePence,
        },
        requestedAt: now,
        dueAt,
      },
      createdBy: actor.userId,
    });

    await this.deps.recorder.recordReoffer(
      tx,
      recordedLot(lot),
      "lot.reoffer_started",
      {
        ...reofferEventBase(
          {
            id: created.id,
            buyerDefaultId: latest.id,
            sequence,
            amountPence: next.bidder.amountMinor,
          },
          "staff",
        ),
        offeredUserId: next.bidder.userId,
        offeredLegalEntityId: next.bidder.legalEntityId,
        consentStatus: requirement.status,
        originalHammerPence: latest.hammerPence,
      },
      actor.userId,
    );

    return {
      reofferId: created.id,
      sequence,
      status: initialReofferStatus(requirement),
      amountPence: next.bidder.amountMinor,
      consentStatus: requirement.status,
      consentDueAt: dueAt,
      skippedBidders: next.skipped,
    };
  }
}
