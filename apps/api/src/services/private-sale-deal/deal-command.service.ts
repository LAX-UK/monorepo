import {
  PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
  type PrivateSalePolicy,
  dealPartyNamedEvent,
  dealRefundRecorded,
  dealTermsChangedEvent,
} from "@auction/domain";
import type {
  IPrivateSaleDealPaymentReader,
  IPrivateSaleDealReader,
  IPrivateSaleDealWriter,
  PrivateSaleDealTermsPatch,
} from "@auction/persistence/interfaces";
import type { PrivateSaleDealDetail } from "@auction/types";
import type { AdminDealBuyerInput, AdminDealTerms, StaffDealAction } from "@auction/validators";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  DealWriteResult,
  IPrivateSaleDealCommands,
} from "../interfaces/private-sale-deal-desk.js";
import {
  OFFER_STAGES,
  REFUND_BLOCKERS,
  TRANSFER_BLOCKERS,
  commandOf,
  redactBlockers,
  termIsOpen,
  toBlocker,
} from "./deal-desk-support.js";
import type { DealInvoiceService } from "./deal-invoice.service.js";
import type { DealPartyResolver } from "./deal-party-resolver.js";
import type { PrivateSaleDealQueryService } from "./deal-query.service.js";
import type { DealReversalService } from "./deal-reversal.service.js";
import {
  ACTION_ABILITY,
  type DealStaffViewer,
  TERM_RULES,
  canDo,
  canSeeDeal,
} from "./deal-staff-permissions.js";
import type { DealTransferService } from "./deal-transfer.service.js";
import type { DealTransitionOutcome, DealTransitionService } from "./deal-transition.service.js";

export type DealCommandDeps = {
  deals: IPrivateSaleDealReader & IPrivateSaleDealWriter;
  payments: Pick<IPrivateSaleDealPaymentReader, "listForDeal">;
  transitions: Pick<DealTransitionService, "transition" | "blockers">;
  invoices: Pick<DealInvoiceService, "issue">;
  reversal: Pick<DealReversalService, "cancel" | "refund">;
  transfers: Pick<DealTransferService, "record">;
  policy: PrivateSalePolicy;
  parties: DealPartyResolver;
  events: IDomainEventSink;
  /** Reads the record a command returns, cut to the person who made it. */
  records: Pick<PrivateSaleDealQueryService, "recordOf">;
};

/**
 * The write side of the staff desk. Every command loads the deal, answers "not found" for one
 * outside the person's scope, checks the version the person was looking at, and only then asks the
 * state machine; the rules themselves live in the domain. Who may make which move, and change which
 * term, is a table in `deal-staff-permissions`.
 */
export class PrivateSaleDealCommandService implements IPrivateSaleDealCommands {
  constructor(private readonly deps: DealCommandDeps) {}

  async updateTerms(
    viewer: DealStaffViewer,
    ref: string,
    change: { version: number; terms: AdminDealTerms },
  ): Promise<DealWriteResult> {
    const deal = await this.load(viewer, ref);
    if (!deal) return { ok: false, error: "deal_not_found" };
    if (deal.version !== change.version) {
      return { ok: false, error: "stale_version", currentVersion: deal.version };
    }
    const fields = Object.keys(change.terms) as (keyof AdminDealTerms)[];

    const forbidden = fields.filter((field) => !canDo(viewer, TERM_RULES[field].ability));
    if (forbidden.length > 0) return { ok: false, error: "forbidden", fields: forbidden };

    const locked = fields.filter((field) => !termIsOpen(deal, field));
    if (locked.length > 0) return { ok: false, error: "term_locked", fields: locked };

    const vat = change.terms.vatTreatment;
    if (vat && !this.deps.policy.vatTreatments.some((t) => t.code === vat)) {
      return { ok: false, error: "vat_treatment_not_allowed", fields: ["vatTreatment"] };
    }

    const written = await this.deps.deals.updateTerms(deal.id, deal.version, toPatch(change.terms));
    if (written.kind === "not_found") return { ok: false, error: "deal_not_found" };
    if (written.kind === "conflict") return this.staleOf(ref);

    const event = dealTermsChangedEvent(deal, fields);
    await this.publish(viewer, deal.id, event);
    return { ok: true, record: await this.deps.records.recordOf(viewer, written.deal) };
  }

  async nameBuyer(
    viewer: DealStaffViewer,
    ref: string,
    input: AdminDealBuyerInput,
  ): Promise<DealWriteResult> {
    if (!canDo(viewer, "manage")) return { ok: false, error: "forbidden" };
    const deal = await this.load(viewer, ref);
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

    await this.publish(
      viewer,
      deal.id,
      dealPartyNamedEvent(deal, { role: "buyer", actingUserId: buyer.actingUserId }),
    );
    return { ok: true, record: await this.deps.records.recordOf(viewer, written.deal) };
  }

  async act(
    viewer: DealStaffViewer,
    ref: string,
    action: StaffDealAction,
    input: { version: number; reason?: string | undefined; amountMinor?: number | undefined },
  ): Promise<DealWriteResult> {
    if (!canDo(viewer, ACTION_ABILITY[action])) return { ok: false, error: "forbidden" };
    const deal = await this.load(viewer, ref);
    if (!deal) return { ok: false, error: "deal_not_found" };
    // A move is made against the deal as the person saw it, like every other change.
    if (deal.version !== input.version) {
      return { ok: false, error: "stale_version", currentVersion: deal.version };
    }

    if (action === "refund") return this.refund(viewer, deal, input.amountMinor);
    if (action === "record_bank_transfer") return this.recordTransfer(viewer, deal, input);
    if (action === "cancel") return this.cancel(viewer, deal, input.reason, input.version);

    const outcome =
      action === "issue_invoice"
        ? await this.deps.invoices.issue({
            dealId: deal.id,
            actorUserId: viewer.userId,
            expectedVersion: input.version,
          })
        : await this.deps.transitions.transition(deal.id, commandOf(action), {
            actorUserId: viewer.userId,
            expectedVersion: input.version,
            ...(action === "release" ? { releaseNote: input.reason ?? "" } : {}),
          });
    if (outcome.kind === "ok" && action === "agree") {
      // Agreement clears the deal in the same step when every check is already green.
      await this.deps.transitions.transition(deal.id, "clear", { actorUserId: viewer.userId });
    }
    return this.resultOf(viewer, ref, outcome);
  }

  /** The deal, or nothing when it does not exist or is outside what this person may see. */
  private async load(viewer: DealStaffViewer, ref: string): Promise<PrivateSaleDealDetail | null> {
    const deal = await this.deps.deals.findByReference(ref);
    return deal && canSeeDeal(viewer, deal) ? deal : null;
  }

  private async cancel(
    viewer: DealStaffViewer,
    deal: PrivateSaleDealDetail,
    reason: string | undefined,
    version: number,
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
      return {
        ok: false,
        error: "blocked",
        blockers: redactBlockers(viewer, blockers.map(toBlocker)),
      };
    }
    const outcome = await this.deps.reversal.cancel({
      dealId: deal.id,
      actorUserId: viewer.userId,
      reason: reason ?? "",
      expectedVersion: version,
    });
    return this.resultOf(viewer, deal.reference, outcome);
  }

  private async refund(
    viewer: DealStaffViewer,
    deal: PrivateSaleDealDetail,
    amountMinor: number | undefined,
  ): Promise<DealWriteResult> {
    const result = await this.deps.reversal.refund({
      dealId: deal.id,
      actorUserId: viewer.userId,
      ...(amountMinor !== undefined ? { amountMinor } : {}),
    });
    if (result.ok) return this.freshRecord(viewer, deal.reference);
    if (result.error === "not_found") return { ok: false, error: "deal_not_found" };
    return { ok: false, error: "blocked", blockers: [REFUND_BLOCKERS[result.error]] };
  }

  /** Finance saw the buyer's bank transfer land: the amount and the bank's reference are recorded. */
  private async recordTransfer(
    viewer: DealStaffViewer,
    deal: PrivateSaleDealDetail,
    input: { reason?: string | undefined; amountMinor?: number | undefined },
  ): Promise<DealWriteResult> {
    if (input.amountMinor === undefined || !input.reason) {
      return {
        ok: false,
        error: "blocked",
        blockers: [
          {
            code: "transfer_details_required",
            message: "Give the amount received and the bank's reference for the transfer.",
          },
        ],
      };
    }
    const result = await this.deps.transfers.record({
      dealId: deal.id,
      recordedByUserId: viewer.userId,
      bankReference: input.reason,
      amountMinor: input.amountMinor,
    });
    if (result.ok) return this.freshRecord(viewer, deal.reference);
    if (result.error === "not_found") return { ok: false, error: "deal_not_found" };
    return { ok: false, error: "blocked", blockers: [TRANSFER_BLOCKERS[result.error]] };
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
        return {
          ok: false,
          error: "blocked",
          blockers: redactBlockers(viewer, outcome.blockers.map(toBlocker)),
        };
    }
  }

  private async freshRecord(viewer: DealStaffViewer, ref: string): Promise<DealWriteResult> {
    const deal = await this.load(viewer, ref);
    return deal
      ? { ok: true, record: await this.deps.records.recordOf(viewer, deal) }
      : { ok: false, error: "deal_not_found" };
  }

  private async staleOf(ref: string): Promise<DealWriteResult> {
    const current = await this.deps.deals.findByReference(ref);
    return {
      ok: false,
      error: "stale_version",
      ...(current ? { currentVersion: current.version } : {}),
    };
  }

  private async publish(
    viewer: DealStaffViewer,
    dealId: string,
    event: ReturnType<typeof dealPartyNamedEvent>,
  ): Promise<void> {
    await this.deps.events.publish({
      aggregateType: PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
      aggregateId: dealId,
      eventType: event.eventType,
      payload: event.payload,
      actorUserId: viewer.userId,
      actingLegalEntityId: null,
    });
  }
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
