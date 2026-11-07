import {
  type DealBlocker,
  type DealClearancePort,
  type DealCommand,
  PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
  type PartyClearance,
  type PrivateSalePolicy,
  dealCommandsFrom,
  dealPartyNamedEvent,
  dealRefundRecorded,
  dealTermIsEditable,
  dealTermsChangedEvent,
  dealViewCounts,
  describeDealBlocker,
  privateSalePolicyGaps,
  projectDealForStaff,
  sourceOfFundsRequired,
  termsAcceptance,
} from "@auction/domain";
import type {
  IMarketingEnquiryRepository,
  IPrivateSaleDealPaymentReader,
  IPrivateSaleDealPayoutStore,
  IPrivateSaleDealQueryReader,
  IPrivateSaleDealReader,
  IPrivateSaleDealWriter,
  PrivateSaleDealTermsPatch,
} from "@auction/persistence/interfaces";
import type { PrivateSaleDealDetail } from "@auction/types";
import {
  type AdminDealBuyerInput,
  type AdminDealListQuery,
  type AdminDealTerms,
  STAFF_DEAL_ACTIONS,
  type StaffDealAction,
} from "@auction/validators";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  DealActionBlocker,
  DealActionState,
  DealListPage,
  DealRecordParty,
  DealStaffRecord,
  DealWriteResult,
  IPrivateSaleDealDesk,
} from "../interfaces/private-sale-deal-desk.js";
import type { DealInvoiceService } from "./deal-invoice.service.js";
import type { DealPartyResolver } from "./deal-party-resolver.js";
import type { DealReversalService } from "./deal-reversal.service.js";
import {
  ACTION_ABILITY,
  type DealStaffViewer,
  TERM_RULES,
  canDo,
} from "./deal-staff-permissions.js";
import type { DealTransitionOutcome, DealTransitionService } from "./deal-transition.service.js";

/** Who staff are, by name, for the timeline. */
export interface DealActorNames {
  namesOf(userIds: readonly string[]): Promise<Map<string, string>>;
}

export type DealDeskDeps = {
  deals: IPrivateSaleDealReader & IPrivateSaleDealWriter;
  queries: IPrivateSaleDealQueryReader;
  payments: Pick<IPrivateSaleDealPaymentReader, "listForDeal">;
  payouts: Pick<IPrivateSaleDealPayoutStore, "hasPayoutLine">;
  transitions: Pick<DealTransitionService, "transition" | "blockers">;
  invoices: Pick<DealInvoiceService, "issue">;
  reversal: Pick<DealReversalService, "cancel" | "refund">;
  clearance: DealClearancePort;
  policy: PrivateSalePolicy;
  parties: DealPartyResolver;
  enquiries: Pick<IMarketingEnquiryRepository, "findById">;
  names: DealActorNames;
  events: IDomainEventSink;
};

const STAFF_COMMANDS: Readonly<Partial<Record<StaffDealAction, DealCommand>>> = {
  open_offer: "open_offer",
  agree: "agree",
  clear: "clear",
  issue_invoice: "issue_invoice",
  release: "release",
  cancel: "cancel",
};

const OFFER_STAGES = new Set(["proposed", "offer"]);

const encodeCursor = (row: { updatedAt: Date; id: string }): string =>
  Buffer.from(`${row.updatedAt.toISOString()}|${row.id}`).toString("base64url");

function decodeCursor(cursor: string | undefined): { updatedAt: Date; id: string } | null {
  if (!cursor) return null;
  const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const updatedAt = iso ? new Date(iso) : null;
  return updatedAt && !Number.isNaN(updatedAt.getTime()) && id ? { updatedAt, id } : null;
}

const toBlocker = (blocker: DealBlocker): DealActionBlocker => ({
  code: blocker.code,
  message: describeDealBlocker(blocker),
  ...(blocker.party ? { party: blocker.party } : {}),
});

/**
 * Staff work on private sale deals here. The rules live in the domain: this reads the deal and
 * its checks, asks the state machine, and carries out what it allows. Who may do which move, and
 * change which term, is a table in `deal-staff-permissions`, applied here rather than in the routes.
 */
export class PrivateSaleDealDeskService implements IPrivateSaleDealDesk {
  constructor(private readonly deps: DealDeskDeps) {}

  async list(viewer: DealStaffViewer, query: AdminDealListQuery): Promise<DealListPage> {
    const rows = await this.deps.queries.list({
      view: query.view,
      viewerUserId: viewer.userId,
      after: decodeCursor(query.cursor),
      limit: query.limit,
    });
    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null,
      counts: dealViewCounts(await this.deps.queries.countByStage(viewer.userId)),
    };
  }

  async detail(viewer: DealStaffViewer, ref: string): Promise<DealStaffRecord | null> {
    const deal = await this.deps.deals.findByReference(ref);
    return deal ? this.recordOf(viewer, deal) : null;
  }

  async updateTerms(
    viewer: DealStaffViewer,
    ref: string,
    change: { version: number; terms: AdminDealTerms },
  ): Promise<DealWriteResult> {
    const deal = await this.deps.deals.findByReference(ref);
    if (!deal) return { ok: false, error: "deal_not_found" };
    if (deal.version !== change.version) {
      return { ok: false, error: "stale_version", currentVersion: deal.version };
    }
    const fields = Object.keys(change.terms) as (keyof AdminDealTerms)[];
    const refused = (pick: (field: keyof AdminDealTerms) => boolean) => fields.filter(pick);

    const forbidden = refused((field) => !canDo(viewer, TERM_RULES[field].ability));
    if (forbidden.length > 0) return { ok: false, error: "forbidden", fields: forbidden };

    const locked = refused((field) => !this.termIsOpen(deal, field));
    if (locked.length > 0) return { ok: false, error: "term_locked", fields: locked };

    const vat = change.terms.vatTreatment;
    if (vat && !this.deps.policy.vatTreatments.some((t) => t.code === vat)) {
      return { ok: false, error: "vat_treatment_not_allowed", fields: ["vatTreatment"] };
    }

    const written = await this.deps.deals.updateTerms(deal.id, deal.version, toPatch(change.terms));
    if (written.kind === "not_found") return { ok: false, error: "deal_not_found" };
    if (written.kind === "conflict") return this.staleOf(ref);

    const event = dealTermsChangedEvent(deal, fields);
    await this.deps.events.publish({
      aggregateType: PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
      aggregateId: deal.id,
      eventType: event.eventType,
      payload: event.payload,
      actorUserId: viewer.userId,
      actingLegalEntityId: null,
    });
    return { ok: true, record: await this.recordOf(viewer, written.deal) };
  }

  async nameBuyer(
    viewer: DealStaffViewer,
    ref: string,
    input: AdminDealBuyerInput,
  ): Promise<DealWriteResult> {
    if (!canDo(viewer, "manage")) return { ok: false, error: "forbidden" };
    const deal = await this.deps.deals.findByReference(ref);
    if (!deal) return { ok: false, error: "deal_not_found" };
    if (deal.version !== input.version) {
      return { ok: false, error: "stale_version", currentVersion: deal.version };
    }
    // The buyer is changed before there is an agreement on the price, never after.
    if (!OFFER_STAGES.has(deal.stage)) return { ok: false, error: "buyer_locked" };

    const buyer = await this.deps.parties.resolve({
      userId: input.buyerUserId,
      ...(input.legalEntityId ? { legalEntityId: input.legalEntityId } : {}),
    });
    if (!buyer) return { ok: false, error: "buyer_invalid" };
    if (buyer.legalEntityId === deal.seller.legalEntityId) {
      return { ok: false, error: "buyer_is_seller" };
    }

    const written = await this.deps.deals.setParty(deal.id, deal.version, {
      role: "buyer",
      legalEntityId: buyer.legalEntityId,
      actingUserId: buyer.actingUserId,
    });
    if (written.kind === "not_found") return { ok: false, error: "deal_not_found" };
    if (written.kind === "conflict") return this.staleOf(ref);

    const event = dealPartyNamedEvent(deal, "buyer");
    await this.deps.events.publish({
      aggregateType: PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
      aggregateId: deal.id,
      eventType: event.eventType,
      payload: event.payload,
      actorUserId: viewer.userId,
      actingLegalEntityId: null,
    });
    return { ok: true, record: await this.recordOf(viewer, written.deal) };
  }

  async act(
    viewer: DealStaffViewer,
    ref: string,
    action: StaffDealAction,
    input: { reason?: string | undefined },
  ): Promise<DealWriteResult> {
    if (!canDo(viewer, ACTION_ABILITY[action])) return { ok: false, error: "forbidden" };
    const deal = await this.deps.deals.findByReference(ref);
    if (!deal) return { ok: false, error: "deal_not_found" };

    if (action === "refund") return this.refund(viewer, deal);
    if (action === "cancel") return this.cancel(viewer, deal, input.reason);

    const outcome =
      action === "issue_invoice"
        ? await this.deps.invoices.issue({ dealId: deal.id, actorUserId: viewer.userId })
        : await this.deps.transitions.transition(deal.id, commandOf(action), {
            actorUserId: viewer.userId,
          });
    if (outcome.kind === "ok" && action === "agree") {
      // Agreement clears the deal in the same step when every check is already green.
      await this.deps.transitions.transition(deal.id, "clear", { actorUserId: viewer.userId });
    }
    return this.resultOf(viewer, ref, outcome);
  }

  private async cancel(
    viewer: DealStaffViewer,
    deal: PrivateSaleDealDetail,
    reason: string | undefined,
  ): Promise<DealWriteResult> {
    // Check the move first: cancelling also ends an open checkout, which must not happen for a
    // cancellation that the rules would refuse.
    const payments = await this.deps.payments.listForDeal(deal.id);
    const blockers = await this.deps.transitions.blockers(deal.id, "cancel", {
      actorUserId: viewer.userId,
      cancelReason: reason ?? "",
      refundRecorded: payments.some((p) => dealRefundRecorded(p)),
    });
    if (blockers && blockers.length > 0) {
      return { ok: false, error: "blocked", blockers: blockers.map(toBlocker) };
    }
    const outcome = await this.deps.reversal.cancel({
      dealId: deal.id,
      actorUserId: viewer.userId,
      reason: reason ?? "",
    });
    return this.resultOf(viewer, deal.reference, outcome);
  }

  private async refund(
    viewer: DealStaffViewer,
    deal: PrivateSaleDealDetail,
  ): Promise<DealWriteResult> {
    const result = await this.deps.reversal.refund({ dealId: deal.id, actorUserId: viewer.userId });
    if (result.ok) return this.freshRecord(viewer, deal.reference);
    if (result.error === "not_found") return { ok: false, error: "deal_not_found" };
    const blocker = REFUND_BLOCKERS[result.error];
    return { ok: false, error: "blocked", blockers: [blocker] };
  }

  private async resultOf(
    viewer: DealStaffViewer,
    ref: string,
    outcome: DealTransitionOutcome,
  ): Promise<DealWriteResult> {
    switch (outcome.kind) {
      case "ok":
        return this.freshRecord(viewer, ref);
      case "not_found":
        return { ok: false, error: "deal_not_found" };
      case "conflict":
        // Either the deal changed under us, or a bank transfer is on its way and cannot be recalled.
        return this.staleOf(ref);
      case "blocked":
        return { ok: false, error: "blocked", blockers: outcome.blockers.map(toBlocker) };
    }
  }

  private async freshRecord(viewer: DealStaffViewer, ref: string): Promise<DealWriteResult> {
    const record = await this.detail(viewer, ref);
    return record ? { ok: true, record } : { ok: false, error: "deal_not_found" };
  }

  private async staleOf(ref: string): Promise<DealWriteResult> {
    const current = await this.deps.deals.findByReference(ref);
    return {
      ok: false,
      error: "stale_version",
      ...(current ? { currentVersion: current.version } : {}),
    };
  }

  private termIsOpen(deal: PrivateSaleDealDetail, field: keyof AdminDealTerms): boolean {
    const { field: term } = TERM_RULES[field];
    return term === null ? OFFER_STAGES.has(deal.stage) : dealTermIsEditable(deal.stage, term);
  }

  private async recordOf(
    viewer: DealStaffViewer,
    deal: PrivateSaleDealDetail,
  ): Promise<DealStaffRecord> {
    const { policy } = this.deps;
    const [clearance, history, work, payments, hasPayoutLine] = await Promise.all([
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
    ]);
    const names = await this.deps.names.namesOf([
      ...new Set(history.flatMap((h) => (h.actorUserId ? [h.actorUserId] : []))),
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
      kyc: checks?.kyc ?? null,
      aml: checks?.aml ?? null,
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
      seller: party("seller", deal.seller, clearance.seller),
      buyer: deal.buyer ? party("buyer", deal.buyer, clearance.buyer) : null,
      sourceOfFunds: {
        status: clearance.buyerSourceOfFunds,
        required:
          deal.priceMinor !== null &&
          sourceOfFundsRequired({
            priceMinor: deal.priceMinor,
            buyerOtherOpenExposureMinor: clearance.buyerOtherOpenExposureMinor,
            thresholdMinor: policy.sourceOfFundsThresholdMinor,
          }),
        thresholdMinor: policy.sourceOfFundsThresholdMinor,
      },
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
        (field) => canDo(viewer, TERM_RULES[field].ability) && this.termIsOpen(deal, field),
      ),
      canNameBuyer: canDo(viewer, "manage") && OFFER_STAGES.has(deal.stage),
      actions: await this.actionsFor(viewer, deal, {
        hasPaidPayment: paid?.status === "paid",
        hasPayoutLine,
        refundRecorded,
      }),
    };
  }

  /** The moves this person may make from the deal's stage, each with what stands in its way. */
  private async actionsFor(
    viewer: DealStaffViewer,
    deal: PrivateSaleDealDetail,
    money: { hasPaidPayment: boolean; hasPayoutLine: boolean; refundRecorded: boolean },
  ): Promise<DealActionState[]> {
    const fromStage = new Set(dealCommandsFrom(deal.stage));
    const offered = STAFF_DEAL_ACTIONS.filter((action) => {
      if (!canDo(viewer, ACTION_ABILITY[action])) return false;
      if (action === "refund") return money.hasPaidPayment;
      const command = STAFF_COMMANDS[action];
      return command !== undefined && fromStage.has(command);
    });
    return Promise.all(
      offered.map(async (action) => ({
        action,
        blockers:
          action === "refund"
            ? money.hasPayoutLine
              ? [REFUND_BLOCKERS.payout_queued]
              : []
            : await this.blockersFor(viewer, deal, commandOf(action), money.refundRecorded),
      })),
    );
  }

  private async blockersFor(
    viewer: DealStaffViewer,
    deal: PrivateSaleDealDetail,
    command: DealCommand,
    refundRecorded: boolean,
  ): Promise<DealActionBlocker[]> {
    const blockers = await this.deps.transitions.blockers(deal.id, command, {
      actorUserId: viewer.userId,
      // The reason is asked for in the dialog, so a missing one is not what keeps the move off.
      ...(command === "cancel" ? { cancelReason: "pending", refundRecorded } : {}),
    });
    return (blockers ?? []).map(toBlocker);
  }
}

function commandOf(action: StaffDealAction): DealCommand {
  const command = STAFF_COMMANDS[action];
  if (!command) throw new RangeError(`${action} is not a deal transition`);
  return command;
}

function toPatch(terms: AdminDealTerms): PrivateSaleDealTermsPatch {
  const patch: PrivateSaleDealTermsPatch = {};
  if (terms.priceMinor !== undefined) patch.priceMinor = terms.priceMinor;
  if (terms.buyerFeeBps !== undefined) patch.buyerFeeBps = terms.buyerFeeBps;
  if (terms.sellerCommissionBps !== undefined)
    patch.sellerCommissionBps = terms.sellerCommissionBps;
  if (terms.costsMinor !== undefined) patch.costsMinor = terms.costsMinor;
  if (terms.vatTreatment !== undefined) patch.vatTreatment = terms.vatTreatment;
  if (terms.partiesDisclosed !== undefined) patch.partiesDisclosed = terms.partiesDisclosed;
  if (terms.offerExpiresAt !== undefined) {
    patch.offerExpiresAt = terms.offerExpiresAt === null ? null : new Date(terms.offerExpiresAt);
  }
  return patch;
}

const REFUND_BLOCKERS: Readonly<
  Record<"nothing_to_refund" | "payout_queued" | "refund_unavailable", DealActionBlocker>
> = {
  nothing_to_refund: {
    code: "no_payment_to_refund",
    message: "The buyer has not paid, so there is nothing to refund.",
  },
  payout_queued: {
    code: "payout_queued",
    message: "The seller's payout already includes this deal, so it cannot be refunded here.",
  },
  refund_unavailable: {
    code: "refund_unavailable",
    message: "The refund could not be made. Finance can return the money from the payment.",
  },
};
