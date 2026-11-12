import type { Database } from "@auction/db";
import {
  type PlacedBid,
  type SkippedBidder,
  bidderReofferStatus,
  claimableShortfall,
  entityActorCan,
  invoiceDueAfterAcceptance,
  selectNextBidder,
} from "@auction/domain";
import type {
  BidderReofferRow,
  IReofferViewsReader,
  IReofferWorkflowReader,
  SellerConsentRequestRow,
  StaffReofferView,
} from "@auction/persistence/interfaces";
import type { InvoiceLineKind } from "@auction/types";
import {
  type BidderReofferPrice,
  type BidderReofferView,
  type SellerReofferView,
  type StaffReoffer,
  bidderReofferViewSchema,
  sellerReofferViewSchema,
  staffReofferSchema,
} from "@auction/validators";
import type { ReofferMemberActor } from "./reoffer-actors.js";
import { ReofferError } from "./reoffer-errors.js";
import type { IReofferPricing } from "./reoffer-ports.js";

export type ReofferReadsServiceDeps = {
  db: Database;
  views: IReofferViewsReader;
  workflow: Pick<IReofferWorkflowReader, "placedBids" | "latestDefault" | "defaultById">;
  pricing: IReofferPricing;
};

/** Lots LAX owns need no answer from anyone, so there is nothing to show a seller. */
const isAskedOfSeller = (row: SellerConsentRequestRow) => row.consentStatus !== "not_needed";

/**
 * The three audiences' reads of an offer, each through its own query and its own strict shape
 * (RA16): staff see the bidder and the shortfall, the seller sees the terms and never the bidder,
 * the bidder sees the price lines and never the seller or the defaulting buyer. Every view is
 * parsed through its contract schema before it leaves, so a field added to a query by mistake
 * cannot reach the wrong party.
 */
export class ReofferReadsService {
  constructor(private readonly deps: ReofferReadsServiceDeps) {}

  /** Staff: every offer of the lot, oldest first. */
  async listForLot(lotId: string): Promise<StaffReoffer[]> {
    const rows = await this.deps.views.listForLot(lotId);
    if (rows.length === 0) return [];
    const bids = await this.deps.workflow.placedBids(this.deps.db, lotId);
    const views: StaffReoffer[] = [];
    for (const row of rows) views.push(await this.staffView(row, rows, bids));
    return views;
  }

  /** The bidder account's own offers that the bidder has been told about. */
  async listForBidder(actor: ReofferMemberActor): Promise<BidderReofferView[]> {
    const rows = await this.deps.views.listForBidderAccount(actor.legalEntityId);
    const views: BidderReofferView[] = [];
    for (const row of rows) views.push(await this.bidderView(row));
    return views;
  }

  async getForBidder(actor: ReofferMemberActor, reofferId: string): Promise<BidderReofferView> {
    const row = await this.deps.views.findForBidderAccount(actor.legalEntityId, reofferId);
    if (!row) throw new ReofferError("offer_not_found", "This offer does not exist.");
    return this.bidderView(row);
  }

  /** The seller account's requests: the people who follow its consignments see them. */
  async listForSeller(actor: ReofferMemberActor): Promise<SellerReofferView[]> {
    this.requireSellerRead(actor);
    const rows = await this.deps.views.listForSellerAccount(actor.legalEntityId);
    const money = seesSellerMoney(actor);
    return rows.filter(isAskedOfSeller).map((row) => sellerView(row, money));
  }

  async getForSeller(actor: ReofferMemberActor, reofferId: string): Promise<SellerReofferView> {
    this.requireSellerRead(actor);
    const row = await this.deps.views.findForSellerAccount(actor.legalEntityId, reofferId);
    if (!row) throw new ReofferError("offer_not_found", "This request does not exist.");
    return sellerView(row, seesSellerMoney(actor));
  }

  private requireSellerRead(actor: ReofferMemberActor): void {
    if (!entityActorCan(memberOf(actor), "entity.consignments.read")) {
      throw new ReofferError("forbidden", "Your role in this account can't see this.");
    }
  }

  private async bidderView(row: BidderReofferRow): Promise<BidderReofferView> {
    const status = bidderReofferStatus({ status: row.status, offerSentAt: row.offerSentAt });
    if (status === null || row.offerEndsAt === null) {
      throw new ReofferError("offer_not_found", "This offer does not exist.");
    }
    const priced = await this.deps.pricing.priceFor({
      lotId: row.lotId,
      buyerLegalEntityId: row.offeredLegalEntityId,
      hammerPence: row.amountPence,
    });
    return bidderReofferViewSchema.parse({
      id: row.id,
      lotId: row.lotId,
      lotTitle: row.lot.title,
      lotNumber: row.lot.lotNumber,
      saleId: row.lot.saleId,
      lotImage: row.lot.image,
      lotEndedAt: row.lotEndedAt.toISOString(),
      status,
      price: bidderPriceLines(priced),
      endsAt: row.offerEndsAt.toISOString(),
      respondedAt: row.respondedAt?.toISOString() ?? null,
      // Only an accepted offer has an invoice. Its stored due date once it is raised (it counts
      // from when it was raised); until then, seven days on from acceptance as the raise will set.
      invoiceDueAt:
        status === "accepted" && row.respondedAt
          ? (priced.invoiceDueAt ?? invoiceDueAfterAcceptance(row.respondedAt)).toISOString()
          : null,
    });
  }

  /** What the bidder would pay, line by line: the same pricing the invoice uses. */
  private async priceOf(lotId: string, buyerLegalEntityId: string, hammerPence: number) {
    const priced = await this.deps.pricing.priceFor({ lotId, buyerLegalEntityId, hammerPence });
    const line = (kind: string) =>
      priced.lines.filter((l) => l.kind === kind).reduce((sum, l) => sum + l.amountPence, 0);
    return {
      hammerMinor: line("hammer"),
      buyersPremiumMinor: line("buyers_premium"),
      // The invoice carries no VAT or resale-right line until the accountant confirms the
      // rules; nothing is invented here, so the lines that do not apply are null or nil.
      vatOnPremiumMinor: line("vat_on_premium"),
      vatOnLotMinor: null,
      artistsResaleRightMinor: null,
      totalMinor: priced.totalPence,
    };
  }

  private async staffView(
    row: StaffReofferView,
    all: readonly StaffReofferView[],
    bids: readonly (PlacedBid & { bidId: string })[],
  ): Promise<StaffReoffer> {
    const { offer, consent } = row;
    if (!consent) throw new Error("A re-offer without its consent record");
    const original = await this.deps.workflow.defaultById(this.deps.db, offer.buyerDefaultId);
    const originalPremium = original
      ? await this.premiumOf(
          offer.lotId,
          original.buyerLegalEntityId,
          consent.terms.originalHammerPence,
        )
      : 0;
    const shortfall = claimableShortfall({
      originalHammerMinor: consent.terms.originalHammerPence,
      newHammerMinor: offer.amountPence,
      originalPremiumMinor: originalPremium,
    });
    return staffReofferSchema.parse({
      id: offer.id,
      lotId: offer.lotId,
      sequence: offer.sequence,
      status: offer.status,
      consentStatus: consent.status,
      bidder: {
        userId: offer.offeredUserId,
        legalEntityId: offer.offeredLegalEntityId,
        accountName: row.offeredAccountName,
      },
      offerMinor: offer.amountPence,
      price: await this.priceOf(offer.lotId, offer.offeredLegalEntityId, offer.amountPence),
      sourceBidId: offer.sourceBidId,
      bidPlacedAt: row.sourceBidPlacedAt?.toISOString() ?? null,
      originalHammerMinor: consent.terms.originalHammerPence,
      estimatedProceedsMinor: consent.terms.proceedsAtOfferPence,
      reserveMinor: consent.terms.reservePence,
      belowReserve:
        consent.terms.reservePence !== null && offer.amountPence < consent.terms.reservePence,
      consentDueAt: consent.dueAt?.toISOString() ?? null,
      consent: {
        channel: consent.channel,
        requestedAt: consent.requestedAt.toISOString(),
        remindedAt: consent.remindedAt?.toISOString() ?? null,
        answeredAt: consent.answeredAt?.toISOString() ?? null,
        answeredByName: consent.answeredByName,
        note: consent.note,
        declinePreference: consent.preferredNext,
      },
      createdAt: offer.createdAt.toISOString(),
      createdByName: row.createdByName,
      offerSentAt: offer.offerSentAt?.toISOString() ?? null,
      offerEndsAt: offer.offerEndsAt?.toISOString() ?? null,
      respondedAt: offer.respondedAt?.toISOString() ?? null,
      declineReason: offer.declineReason,
      closeReason: offer.closeReason,
      closedByName: row.closedByName,
      invoiceId: offer.invoiceId,
      claimableShortfall: shortfall,
      skippedBidders: original ? skippedBefore(offer, all, bids, original) : [],
    });
  }

  private async premiumOf(lotId: string, buyerLegalEntityId: string, hammerPence: number) {
    const priced = await this.deps.pricing.priceFor({ lotId, buyerLegalEntityId, hammerPence });
    return priced.lines
      .filter((l) => l.kind === "buyers_premium")
      .reduce((sum, l) => sum + l.amountPence, 0);
  }
}

/**
 * The invoice's own lines as the bidder's price: one field per kind of line, `null` when the
 * invoice has no line of that kind, so the page shows exactly the lines the invoice will carry and
 * nothing it will not. The invoice has no separate VAT-on-premium line, so that field stays
 * `null`. A line of a kind the page cannot show is refused rather than left out of the sum.
 */
export function bidderPriceLines(priced: {
  lines: readonly { kind: string; amountPence: number }[];
  totalPence: number;
}): BidderReofferPrice {
  const shown = new Set<string>(Object.values(PRICE_LINE_KINDS));
  const unshown = priced.lines.find((l) => !shown.has(l.kind));
  if (unshown) throw new Error(`An invoice line the offer page cannot show: ${unshown.kind}`);
  const sum = (kind: string): number | null => {
    const lines = priced.lines.filter((l) => l.kind === kind);
    return lines.length === 0 ? null : lines.reduce((total, l) => total + l.amountPence, 0);
  };
  return {
    hammerMinor: sum(PRICE_LINE_KINDS.hammer) ?? 0,
    buyersPremiumMinor: sum(PRICE_LINE_KINDS.buyersPremium),
    vatOnPremiumMinor: null,
    vatOnLotMinor: sum(PRICE_LINE_KINDS.vatOnLot),
    artistsResaleRightMinor: sum(PRICE_LINE_KINDS.artistsResaleRight),
    totalMinor: priced.totalPence,
  };
}

/** The invoice line kinds behind each line of the bidder's price. */
const PRICE_LINE_KINDS = {
  hammer: "hammer",
  buyersPremium: "buyers_premium",
  vatOnLot: "vat_on_hammer",
  artistsResaleRight: "artists_resale_right",
} as const satisfies Record<string, InvoiceLineKind>;

/**
 * The bidders passed over (suspended, closed or being deleted) on the way to this offer's bidder,
 * worked out the same way the bidder was chosen: from the offers made before this one.
 */
function skippedBefore(
  offer: StaffReofferView["offer"],
  all: readonly StaffReofferView[],
  bids: readonly PlacedBid[],
  original: { buyerId: string; buyerLegalEntityId: string },
): SkippedBidder[] {
  const earlier = all
    .filter((other) => other.offer.buyerDefaultId === offer.buyerDefaultId)
    .filter((other) => other.offer.sequence < offer.sequence)
    .map((other) => ({
      userId: other.offer.offeredUserId,
      legalEntityId: other.offer.offeredLegalEntityId,
      status: other.offer.status,
      offerSentAt: other.offer.offerSentAt,
    }));
  const picked = selectNextBidder({
    bids,
    defaultingBuyer: { userId: original.buyerId, legalEntityId: original.buyerLegalEntityId },
    alreadyOffered: earlier,
  });
  return picked.skipped;
}

function memberOf(actor: ReofferMemberActor) {
  return { role: actor.role, isImpersonation: actor.isImpersonation };
}

/**
 * The seller's money is for the members who see the account's payouts (owners, admins, finance),
 * as on Sold & payouts; a viewer or a consignor follows the request without it.
 */
function seesSellerMoney(actor: ReofferMemberActor): boolean {
  return entityActorCan(memberOf(actor), "entity.payouts.read");
}

function sellerView(row: SellerConsentRequestRow, withMoney: boolean): SellerReofferView {
  const { terms } = row;
  return sellerReofferViewSchema.parse({
    id: row.reofferId,
    lotId: row.lotId,
    lotTitle: row.lot.title,
    lotNumber: row.lot.lotNumber,
    lotEndedAt: row.lot.endedAt.toISOString(),
    status: row.offerStatus,
    consentStatus: row.consentStatus,
    offerMinor: terms.amountPence,
    proceeds: withMoney
      ? {
          // Requests started before the sale total was kept were worked out on the hammer alone.
          offerSaleMinor: terms.saleAtOfferPence ?? terms.amountPence,
          offerProceedsMinor: terms.proceedsAtOfferPence,
          originalHammerMinor: terms.originalHammerPence,
          originalProceedsMinor: terms.proceedsAtOriginalPence,
        }
      : null,
    reserveMinor: terms.reservePence,
    belowReserve: terms.reservePence !== null && terms.amountPence < terms.reservePence,
    answerDueAt: row.dueAt?.toISOString() ?? null,
    answeredAt: row.answeredAt?.toISOString() ?? null,
    answeredBy: row.answerChannel === "house_stock" ? null : row.answerChannel,
    declinePreference: row.preferredNext,
    offerEndsAt: row.offerEndsAt?.toISOString() ?? null,
    soldAt: row.offerStatus === "accepted" ? (row.respondedAt?.toISOString() ?? null) : null,
  });
}
