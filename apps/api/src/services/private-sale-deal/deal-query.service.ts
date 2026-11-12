import {
  type DealClearancePort,
  type PartyClearance,
  type PrivateSalePolicy,
  canChangeArtwork,
  canLinkArtwork,
  dealCommandsFrom,
  dealRefundRecorded,
  dealRefundableMinor,
  dealViewCounts,
  privateSalePolicyGaps,
  projectDealForStaff,
  sourceOfFundsRequired,
  termsAcceptance,
} from "@auction/domain";
import type {
  IArtworkRegisterReader,
  IMarketingEnquiryRepository,
  IPrivateSaleDealPaymentReader,
  IPrivateSaleDealPayoutStore,
  IPrivateSaleDealQueryReader,
  IPrivateSaleDealReader,
} from "@auction/persistence/interfaces";
import type { PrivateSaleDealDetail } from "@auction/types";
import {
  type AdminDealListQuery,
  type AdminDealTerms,
  STAFF_DEAL_ACTIONS,
} from "@auction/validators";
import type {
  DealActionBlocker,
  DealActionState,
  DealArtworkAccess,
  DealListPage,
  DealRecordArtwork,
  DealRecordParty,
  DealStaffRecord,
  IPrivateSaleDealQueries,
} from "../interfaces/private-sale-deal-desk.js";
import type { DealArtworkPresenter } from "./deal-artwork-presenter.js";
import {
  OFFER_STAGES,
  REFUND_BLOCKERS,
  STAFF_COMMANDS,
  TRANSFER_BLOCKERS,
  commandOf,
  redactBlockers,
  termIsOpen,
  toBlocker,
} from "./deal-desk-support.js";
import type { DealLockLinks } from "./deal-lock-links.js";
import type { DealSettlementFollowUpPresenter } from "./deal-settlement-follow-up.presenter.js";
import {
  ACTION_ABILITY,
  type DealStaffViewer,
  TERM_RULES,
  canDo,
  canSeeDeal,
} from "./deal-staff-permissions.js";
import type { DealTransitionService } from "./deal-transition.service.js";

/** Who staff are, by name, for the timeline. */
export interface DealActorNames {
  namesOf(userIds: readonly string[]): Promise<Map<string, string>>;
}

export type DealQueryDeps = {
  deals: Pick<IPrivateSaleDealReader, "findByReference" | "history" | "artworkHistory">;
  queries: IPrivateSaleDealQueryReader;
  payments: Pick<IPrivateSaleDealPaymentReader, "listForDeal">;
  payouts: Pick<IPrivateSaleDealPayoutStore, "hasPayoutLine">;
  transitions: Pick<DealTransitionService, "blockers">;
  clearance: DealClearancePort;
  policy: PrivateSalePolicy;
  enquiries: Pick<IMarketingEnquiryRepository, "findById">;
  names: DealActorNames;
  /** The register, to name the artworks a deal's history mentions. */
  register: Pick<IArtworkRegisterReader, "findById">;
  artworkPresenter: Pick<DealArtworkPresenter, "present">;
  /** The address of an artwork's record in LAX Admin. */
  links: Pick<DealLockLinks, "recordHref">;
  /** Whether a settled deal's artwork is recorded sold, read from the register. */
  settlement: Pick<DealSettlementFollowUpPresenter, "present">;
};

/** Why change and remove are off once the buyer has agreed to the artwork. */
export const ARTWORK_CHANGE_OFF = "Change artwork is off from Agreed onwards.";

const encodeCursor = (row: { updatedAt: Date; id: string }): string =>
  Buffer.from(`${row.updatedAt.toISOString()}|${row.id}`).toString("base64url");

function decodeCursor(cursor: string | undefined): { updatedAt: Date; id: string } | null {
  if (!cursor) return null;
  const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const updatedAt = iso ? new Date(iso) : null;
  return updatedAt && !Number.isNaN(updatedAt.getTime()) && id ? { updatedAt, id } : null;
}

/**
 * The read side of the staff desk: the lists and the record. What a person sees is cut to their
 * scope (a deal outside it does not exist for them) and to their abilities (the checks are shown
 * only to those who run the deal or decide them).
 */
export class PrivateSaleDealQueryService implements IPrivateSaleDealQueries {
  constructor(private readonly deps: DealQueryDeps) {}

  async list(viewer: DealStaffViewer, query: AdminDealListQuery): Promise<DealListPage> {
    const rows = await this.deps.queries.list({
      view: query.view,
      viewerUserId: viewer.userId,
      scope: viewer.scope,
      after: decodeCursor(query.cursor),
      limit: query.limit,
    });
    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    const [stages, followUps] = await Promise.all([
      this.deps.queries.countByStage(viewer.userId, viewer.scope),
      this.deps.queries.countSettlementFollowUps(viewer.scope),
    ]);
    return {
      items,
      nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null,
      counts: dealViewCounts(stages, followUps.total),
      urgentFollowUps: followUps.urgent,
    };
  }

  attentionCount(viewer: DealStaffViewer): Promise<{ total: number; urgent: number }> {
    return this.deps.queries.countSettlementFollowUps(viewer.scope);
  }

  async detail(viewer: DealStaffViewer, ref: string): Promise<DealStaffRecord | null> {
    const deal = await this.deps.deals.findByReference(ref);
    return deal && canSeeDeal(viewer, deal) ? this.recordOf(viewer, deal) : null;
  }

  /** The record of a deal the caller has already loaded and checked against the viewer's scope. */
  async recordOf(viewer: DealStaffViewer, deal: PrivateSaleDealDetail): Promise<DealStaffRecord> {
    const { policy } = this.deps;
    const [clearance, history, work, payments, hasPayoutLine, artwork] = await Promise.all([
      this.deps.clearance.snapshot({
        dealId: deal.id,
        seller: {
          legalEntityId: deal.seller.legalEntityId,
          actingUserId: deal.seller.actingUserId,
        },
        buyer: deal.buyer
          ? { legalEntityId: deal.buyer.legalEntityId, actingUserId: deal.buyer.actingUserId }
          : null,
      }),
      this.deps.deals.history(deal.id),
      this.deps.queries.findWorkSummary(deal.itemSubmissionId),
      this.deps.payments.listForDeal(deal.id),
      this.deps.payouts.hasPayoutLine(deal.id),
      this.artworkOf(viewer, deal),
    ]);
    const names = await this.deps.names.namesOf([
      ...new Set(
        [...history, ...artwork.history].flatMap((h) => (h.actorUserId ? [h.actorUserId] : [])),
      ),
    ]);
    const sourceEnquiry = deal.sourceEnquiryId
      ? await this.deps.enquiries.findById(deal.sourceEnquiryId)
      : null;

    const accepted =
      policy.termsVersion === null
        ? { seller: false, buyer: false }
        : termsAcceptance(deal, deal.documents, policy.termsVersion);
    const party = (
      role: "seller" | "buyer",
      who: PrivateSaleDealDetail["seller"],
      checks: PartyClearance | null,
    ): DealRecordParty => ({
      role,
      legalEntityId: who.legalEntityId,
      displayName: who.displayName,
      kyc: viewer.checks ? (checks?.kyc ?? null) : null,
      aml: viewer.checks ? (checks?.aml ?? null) : null,
      accepted: accepted[role],
    });
    const livePayment = payments.find((p) => p.status !== "cancelled") ?? null;
    const paid = payments.find((p) => p.status === "paid" || p.status === "refunded") ?? null;
    const refundRecorded = payments.some((p) => dealRefundRecorded(p));

    return {
      reference: deal.reference,
      stage: deal.stage,
      version: deal.version,
      work: {
        id: deal.itemSubmissionId,
        title: work?.title ?? "Untitled work",
        reference: work?.reference ?? "",
      },
      sourceEnquiryReference: sourceEnquiry?.reference ?? null,
      ownerUserId: deal.ownerUserId,
      priceMinor: deal.priceMinor,
      buyerFeeBps: deal.buyerFeeBps,
      sellerCommissionBps: deal.sellerCommissionBps,
      costsMinor: deal.costsMinor,
      vatTreatment: deal.vatTreatment,
      partiesDisclosed: deal.partiesDisclosed,
      offerExpiresAt: deal.offerExpiresAt,
      paymentDueAt: deal.paymentDueAt,
      collectionDueAt: deal.collectionDueAt,
      agreedAt: deal.agreedAt,
      invoiceReference: deal.invoiceReference,
      cancelReason: deal.cancelReason,
      cancelledAt: deal.cancelledAt,
      createdAt: deal.createdAt,
      updatedAt: deal.updatedAt,
      money: projectDealForStaff(deal).money,
      artwork: artwork.shown,
      artworkUnlinkedReason: deal.artworkUnlinkedReason,
      artworkAccess: artworkAccessOf(viewer, deal),
      settlementFollowUp: await this.deps.settlement.present(
        viewer,
        deal,
        [...history].reverse().find((h) => h.toStage === "settled")?.createdAt ?? deal.updatedAt,
      ),
      artworkMoves: artwork.history.map((move) => ({
        action: move.action,
        from: artwork.titles.get(move.fromArtworkRegisterId ?? "") ?? null,
        to: artwork.titles.get(move.toArtworkRegisterId ?? "") ?? null,
        fromUnlinkedReason: move.fromUnlinkedReason,
        toUnlinkedReason: move.toUnlinkedReason,
        reason: move.reason,
        createdAt: move.createdAt,
        actorName: move.actorUserId ? (names.get(move.actorUserId) ?? "Former staff member") : null,
      })),
      seller: party("seller", deal.seller, clearance.seller),
      buyer: deal.buyer ? party("buyer", deal.buyer, clearance.buyer) : null,
      sourceOfFunds: viewer.checks
        ? {
            status: clearance.buyerSourceOfFunds,
            required:
              deal.priceMinor !== null &&
              sourceOfFundsRequired({
                priceMinor: deal.priceMinor,
                buyerOtherOpenExposureMinor: clearance.buyerOtherOpenExposureMinor,
                thresholdMinor: policy.sourceOfFundsThresholdMinor,
              }),
            thresholdMinor: policy.sourceOfFundsThresholdMinor,
          }
        : null,
      documents: deal.documents.map((d) => ({
        id: d.id,
        kind: d.kind,
        version: d.version,
        acceptedAt: d.acceptedAt,
        legalEntityId: d.legalEntityId,
        audience: d.audience,
      })),
      payment: livePayment
        ? {
            status: livePayment.status,
            rail: livePayment.rail,
            amountMinor: livePayment.amountMinor,
            paidAt: livePayment.paidAt,
            refundedMinor: livePayment.refundedMinor,
            recordedTransfer: livePayment.bankReference !== null,
          }
        : null,
      timeline: history.map((h) => ({
        fromStage: h.fromStage,
        toStage: h.toStage,
        reason: h.reason,
        createdAt: h.createdAt,
        actorName: h.actorUserId ? (names.get(h.actorUserId) ?? "Former staff member") : null,
      })),
      policy: {
        gaps: privateSalePolicyGaps(policy),
        termsVersion: policy.termsVersion,
        vatTreatments: [...policy.vatTreatments],
      },
      editableTerms: (Object.keys(TERM_RULES) as (keyof AdminDealTerms)[]).filter(
        (field) => canDo(viewer, TERM_RULES[field].ability) && termIsOpen(deal, field),
      ),
      canNameBuyer: canDo(viewer, "manage") && OFFER_STAGES.has(deal.stage),
      actions: await this.actionsFor(viewer, deal, {
        hasPaidPayment:
          paid?.status === "paid" && dealRefundableMinor(paid) > 0 && paid.bankReference === null,
        hasRecordedTransferToReturn:
          paid?.status === "paid" && dealRefundableMinor(paid) > 0 && paid.bankReference !== null,
        transferInFlight: payments.some((p) => p.status === "processing"),
        hasPayoutLine,
        refundRecorded,
      }),
    };
  }

  /** The deal's linked artwork as shown on its page, and the artworks its history names. */
  private async artworkOf(
    viewer: DealStaffViewer,
    deal: PrivateSaleDealDetail,
  ): Promise<{
    shown: DealRecordArtwork | null;
    history: Awaited<ReturnType<DealQueryDeps["deals"]["artworkHistory"]>>;
    titles: Map<string, { title: string; stockCode: string }>;
  }> {
    const history = await this.deps.deals.artworkHistory(deal.id);
    const ids = [
      ...new Set(
        [
          deal.artworkRegisterId,
          ...history.flatMap((h) => [h.fromArtworkRegisterId, h.toArtworkRegisterId]),
        ].filter((id): id is string => id !== null),
      ),
    ];
    const entries = (await Promise.all(ids.map((id) => this.deps.register.findById(id)))).flatMap(
      (entry) => (entry ? [entry] : []),
    );
    const titles = new Map(
      entries.map((entry) => [entry.id, { title: entry.title, stockCode: entry.stockCode }]),
    );
    const linked = entries.find((entry) => entry.id === deal.artworkRegisterId);
    if (!linked) return { shown: null, history, titles };
    const presented = (await this.deps.artworkPresenter.present([linked])).get(linked.id);
    if (!presented) return { shown: null, history, titles };
    const { draftLot: _draftLot, ...summary } = presented.summary;
    const heldAt = [...history].reverse().find((h) => h.toArtworkRegisterId !== null)?.createdAt;
    return {
      shown: {
        ...summary,
        heldSince: heldAt ?? deal.createdAt,
        recordHref: canDo(viewer, "manage") ? this.deps.links.recordHref(linked.id) : null,
      },
      history,
      titles,
    };
  }

  /** The moves this person may make from the deal's stage, each with what stands in its way. */
  private async actionsFor(
    viewer: DealStaffViewer,
    deal: PrivateSaleDealDetail,
    money: {
      hasPaidPayment: boolean;
      hasRecordedTransferToReturn: boolean;
      transferInFlight: boolean;
      hasPayoutLine: boolean;
      refundRecorded: boolean;
    },
  ): Promise<DealActionState[]> {
    const fromStage = new Set(dealCommandsFrom(deal.stage));
    const offered = STAFF_DEAL_ACTIONS.filter((action) => {
      if (!canDo(viewer, ACTION_ABILITY[action])) return false;
      if (action === "refund") return money.hasPaidPayment;
      if (action === "record_bank_transfer") return deal.stage === "invoiced";
      if (action === "record_bank_refund") return money.hasRecordedTransferToReturn;
      const command = STAFF_COMMANDS[action];
      return command !== undefined && fromStage.has(command);
    });
    return Promise.all(
      offered.map(async (action) => ({
        action,
        blockers:
          action === "refund" || action === "record_bank_refund"
            ? money.hasPayoutLine
              ? [REFUND_BLOCKERS.payout_queued]
              : []
            : action === "record_bank_transfer"
              ? money.transferInFlight
                ? [TRANSFER_BLOCKERS.transfer_in_flight]
                : []
              : await this.blockersFor(viewer, deal, action, money.refundRecorded),
      })),
    );
  }

  private async blockersFor(
    viewer: DealStaffViewer,
    deal: PrivateSaleDealDetail,
    action: (typeof STAFF_DEAL_ACTIONS)[number],
    refundRecorded: boolean,
  ): Promise<DealActionBlocker[]> {
    const command = commandOf(action);
    const blockers = await this.deps.transitions.blockers(deal.id, command, {
      actorUserId: viewer.userId,
      // The reason is asked for in the dialog, so a missing one is not what keeps the move off.
      ...(command === "cancel" ? { cancelReason: "pending", refundRecorded } : {}),
      ...(command === "release" ? { releaseNote: "pending" } : {}),
    });
    return redactBlockers(viewer, (blockers ?? []).map(toBlocker));
  }
}

/** Link while the deal is open; change and remove only before the buyer has agreed. */
function artworkAccessOf(viewer: DealStaffViewer, deal: PrivateSaleDealDetail): DealArtworkAccess {
  const manage = canDo(viewer, "manage");
  const held = deal.artworkRegisterId !== null;
  const open = canLinkArtwork(deal.stage);
  return {
    canLink: manage && !held && open,
    canChange: manage && held && canChangeArtwork(deal.stage),
    changeOffReason:
      manage && held && open && !canChangeArtwork(deal.stage) ? ARTWORK_CHANGE_OFF : null,
  };
}
