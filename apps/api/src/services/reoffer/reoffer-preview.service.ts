import type { Database } from "@auction/db";
import {
  MAX_REOFFERS_PER_DEFAULT,
  type NextBidderResult,
  type OfferedParty,
  type PlacedBid,
  type PriorOffer,
  offersCountedTowardCap,
  selectNextBidder,
} from "@auction/domain";
import type { IReofferStaffReader, IReofferWorkflowReader } from "@auction/persistence/interfaces";
import {
  type ReofferPreview,
  type StaffBuyerDefault,
  reofferPreviewSchema,
  staffBuyerDefaultSchema,
} from "@auction/validators";
import { ReofferError } from "./reoffer-errors.js";
import type { IReofferAtgGuard } from "./reoffer-ports.js";

export type ReofferPreviewServiceDeps = {
  db: Database;
  staff: IReofferStaffReader;
  workflow: Pick<IReofferWorkflowReader, "placedBids" | "latestDefault" | "priorOffers">;
  atg: IReofferAtgGuard;
};

/** A stand-in for "this bidder is offered", to look one bidder further down the line. */
function asOffered(party: OfferedParty): PriorOffer {
  return { ...party, status: "offered", offerSentAt: new Date(0) };
}

/**
 * Staff's read of where a lot stands before and after a buyer default: who the next offer would
 * go to, at their highest placed bid, and the default's own facts. Identities are shown to staff
 * only (RA16), and nothing here reads a hidden maximum.
 */
export class ReofferPreviewService {
  constructor(private readonly deps: ReofferPreviewServiceDeps) {}

  async previewForLot(lotId: string): Promise<ReofferPreview> {
    const { db, staff, workflow } = this.deps;
    const lot = await staff.lotFacts(db, lotId);
    if (!lot || lot.deleted) throw new ReofferError("lot_not_found", "Lot not found.");
    const soldOnAtg = await this.deps.atg.soldOnAtg(lotId);
    if (soldOnAtg) return this.empty({ soldOnAtg, noneReason: "no_buyer" });

    const latest = await workflow.latestDefault(db, lotId);
    // Before a default the buyer is the lot's winner; after one, the buyer who defaulted.
    const buyer: OfferedParty | null = latest
      ? { userId: latest.buyerId, legalEntityId: latest.buyerLegalEntityId }
      : lot.winnerId && lot.winnerLegalEntityId
        ? { userId: lot.winnerId, legalEntityId: lot.winnerLegalEntityId }
        : null;
    if (!buyer) return this.empty({ soldOnAtg, noneReason: "no_buyer" });

    const bids = await workflow.placedBids(db, lotId);
    const prior = latest ? await workflow.priorOffers(db, latest.id) : [];
    const picked = selectNextBidder({ bids, defaultingBuyer: buyer, alreadyOffered: prior });
    const offersMade = offersCountedTowardCap(prior);
    if (picked.kind === "none") {
      return this.empty({
        soldOnAtg,
        noneReason: picked.reason,
        offersMade,
        skipped: picked.skipped,
      });
    }

    const { bidder } = picked;
    const placed = this.placedBid(bids, bidder);
    const names = await staff.accountNames(db, [bidder.legalEntityId]);
    return reofferPreviewSchema.parse({
      soldOnAtg,
      next: {
        userId: bidder.userId,
        legalEntityId: bidder.legalEntityId,
        accountName: names.get(bidder.legalEntityId) ?? null,
        bidMinor: bidder.amountMinor,
        placedAt: (placed?.placedAt ?? new Date()).toISOString(),
        belowReserve: lot.reservePence !== null && bidder.amountMinor < lot.reservePence,
        othersAfter: this.othersAfter({ bids, buyer, prior, next: bidder, offersMade }),
      },
      noneReason: null,
      skippedBidders: picked.skipped,
      offersMade,
    });
  }

  /** The buyer default the lot's re-offer answers, or `null` while the lot has none. */
  async buyerDefaultForLot(lotId: string): Promise<StaffBuyerDefault | null> {
    const view = await this.deps.staff.latestDefaultView(this.deps.db, lotId);
    if (!view) return null;
    return staffBuyerDefaultSchema.parse({
      id: view.id,
      recordedAt: view.recordedAt.toISOString(),
      recordedByName: view.recordedByName,
      reason: view.reason,
      outcome: view.outcome,
      originalHammerMinor: view.originalHammerPence,
      wonAt: view.wonAt.toISOString(),
      buyerRestricted: view.buyerRestricted,
      buyerUserId: view.buyerUserId,
      buyerAccountName: view.buyerAccountName,
      voidedInvoiceNumber: view.voidedInvoiceNumber,
      voidedInvoiceTotalMinor: view.voidedInvoiceTotalPence,
      voidedInvoiceDueAt: view.voidedInvoiceDueAt?.toISOString() ?? null,
    });
  }

  private placedBid(bids: readonly PlacedBid[], bidder: OfferedParty & { amountMinor: number }) {
    return bids.find(
      (bid) =>
        bid.userId === bidder.userId &&
        bid.legalEntityId === bidder.legalEntityId &&
        bid.amountMinor === bidder.amountMinor,
    );
  }

  /** How many more bidders could be offered the lot after this one, within the cap. */
  private othersAfter(input: {
    bids: readonly PlacedBid[];
    buyer: OfferedParty;
    prior: readonly PriorOffer[];
    next: OfferedParty;
    offersMade: number;
  }): number {
    const room = MAX_REOFFERS_PER_DEFAULT - input.offersMade - 1;
    let alreadyOffered = [...input.prior, asOffered(input.next)];
    let count = 0;
    while (count < room) {
      const again: NextBidderResult = selectNextBidder({
        bids: input.bids,
        defaultingBuyer: input.buyer,
        alreadyOffered,
      });
      if (again.kind !== "found") break;
      count += 1;
      alreadyOffered = [...alreadyOffered, asOffered(again.bidder)];
    }
    return count;
  }

  private empty(input: {
    soldOnAtg: boolean;
    noneReason: ReofferPreview["noneReason"];
    offersMade?: number;
    skipped?: ReofferPreview["skippedBidders"];
  }): ReofferPreview {
    return reofferPreviewSchema.parse({
      soldOnAtg: input.soldOnAtg,
      next: null,
      noneReason: input.noneReason,
      skippedBidders: input.skipped ?? [],
      offersMade: input.offersMade ?? 0,
    });
  }
}
