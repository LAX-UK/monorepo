import {
  type DealClearancePort,
  PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
  type PrivateSalePolicy,
  dealPaymentBlockers,
  dealTermsAcceptedEvent,
  partyIsClear,
  projectDealForParty,
  sourceOfFundsRequired,
  termsAcceptance,
} from "@auction/domain";
import type {
  ILegalEntityMembershipReader,
  IPrivateSaleDealQueryReader,
  IPrivateSaleDealReader,
  IPrivateSaleDocumentWriter,
} from "@auction/persistence/interfaces";
import type { PrivateSaleDealDetail, PrivateSalePartyRole } from "@auction/types";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  AcceptTermsResult,
  IPrivateSaleDealParties,
  PartyDealDetail,
  PartyDealNeed,
  PartyDealRow,
  PayDealResult,
} from "../interfaces/private-sale-deal-desk.js";
import type { DealPaymentService } from "./deal-payment.service.js";

const LIST_LIMIT = 50;

export type DealPartiesDeps = {
  deals: IPrivateSaleDealReader & IPrivateSaleDocumentWriter;
  queries: Pick<IPrivateSaleDealQueryReader, "listIdsForActingUser" | "findWorkSummary">;
  clearance: DealClearancePort;
  policy: PrivateSalePolicy;
  memberships: Pick<ILegalEntityMembershipReader, "findActiveMembership">;
  payments: Pick<DealPaymentService, "start">;
  events: IDomainEventSink;
  now?: () => Date;
};

/** The stages in which a client's own checks can still stand between them and the deal. */
const CHECKED_STAGES = new Set(["offer", "agreed", "cleared", "invoiced"]);

/**
 * What a buyer or seller sees of their own deals, and the one thing they do on them: accept the
 * private sale terms. Every view is built by the domain's party projection, so the other side
 * appears as LAX and a client never sees a fee, check result or document that is not theirs. A
 * deal the person is not named in does not exist for them.
 */
export class PrivateSaleDealPartyService implements IPrivateSaleDealParties {
  constructor(private readonly deps: DealPartiesDeps) {}

  async list(userId: string): Promise<PartyDealRow[]> {
    const ids = await this.deps.queries.listIdsForActingUser(userId, LIST_LIMIT);
    const deals = await Promise.all(ids.map((id) => this.deps.deals.findById(id)));
    const rows: PartyDealRow[] = [];
    for (const deal of deals) {
      const role = deal ? await this.roleOf(deal, userId) : null;
      if (!deal || !role) continue;
      const view = projectDealForParty(deal, role);
      if (!view) continue;
      const work = await this.deps.queries.findWorkSummary(deal.itemSubmissionId);
      rows.push({
        reference: deal.reference,
        role,
        stage: deal.stage,
        workTitle: work?.title ?? "Untitled work",
        workReference: work?.reference ?? "",
        priceMinor: view.buyerMoney?.priceMinor ?? view.sellerMoney?.priceMinor ?? null,
        totalDueMinor: view.buyerMoney?.totalDueMinor ?? null,
        netToSellerMinor: view.sellerMoney?.netToSellerMinor ?? null,
        paymentDueAt: view.paymentDueAt,
        needs: (await this.needsOf(deal, role)).need,
        updatedAt: deal.updatedAt,
      });
    }
    return rows;
  }

  async detail(userId: string, ref: string): Promise<PartyDealDetail | null> {
    const deal = await this.deps.deals.findByReference(ref);
    return deal ? this.detailOf(deal, userId) : null;
  }

  async acceptTerms(userId: string, ref: string): Promise<AcceptTermsResult> {
    const deal = await this.deps.deals.findByReference(ref);
    const role = deal ? await this.roleOf(deal, userId) : null;
    if (!deal || !role) return { ok: false, error: "deal_not_found" };
    const { termsVersion } = this.deps.policy;
    if (termsVersion === null) return { ok: false, error: "terms_not_configured" };
    // The terms are accepted while the price is being agreed, and not after.
    if (deal.stage !== "offer") return { ok: false, error: "not_open_for_terms" };

    const party = role === "seller" ? deal.seller : deal.buyer;
    if (!party) return { ok: false, error: "deal_not_found" };
    await this.deps.deals.recordAcceptance({
      dealId: deal.id,
      kind: "terms",
      legalEntityId: party.legalEntityId,
      version: termsVersion,
      userId,
      at: (this.deps.now ?? (() => new Date()))(),
    });
    const event = dealTermsAcceptedEvent(deal, { role, version: termsVersion });
    await this.deps.events.publish({
      aggregateType: PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
      aggregateId: deal.id,
      eventType: event.eventType,
      payload: event.payload,
      actorUserId: userId,
      actingLegalEntityId: party.legalEntityId,
    });
    const fresh = await this.deps.deals.findById(deal.id);
    const detail = fresh ? await this.detailOf(fresh, userId) : null;
    return detail ? { ok: true, detail } : { ok: false, error: "deal_not_found" };
  }

  async pay(userId: string, ref: string): Promise<PayDealResult> {
    const deal = await this.deps.deals.findByReference(ref);
    // Only the buyer pays; the seller, and anyone else, learns nothing about the deal.
    if (!deal || (await this.roleOf(deal, userId)) !== "buyer")
      return { ok: false, error: "deal_not_found" };
    const result = await this.deps.payments.start({ dealId: deal.id, payerUserId: userId });
    if (result.ok) {
      return {
        ok: true,
        checkoutUrl: result.started.checkoutUrl,
        amountMinor: result.started.amountMinor,
      };
    }
    switch (result.error.kind) {
      case "not_found":
      case "forbidden":
        return { ok: false, error: "deal_not_found" };
      case "blocked":
        return { ok: false, error: "not_payable" };
      case "compliance_hold":
      case "not_payable_online":
      case "already_paid":
      case "in_progress":
      case "unavailable":
        return { ok: false, error: result.error.kind };
    }
  }

  /**
   * Which side of the deal the person is on: the one they are named to act for, and only while they
   * still have a place in that account. Someone who has left the organisation has no deal here.
   */
  private async roleOf(
    deal: PrivateSaleDealDetail,
    userId: string,
  ): Promise<PrivateSalePartyRole | null> {
    const sides = [
      ["buyer", deal.buyer],
      ["seller", deal.seller],
    ] as const;
    for (const [role, party] of sides) {
      if (party?.actingUserId === userId && (await this.isMember(userId, party.legalEntityId))) {
        return role;
      }
    }
    return null;
  }

  /** A read-only lookup: reading a deal never creates an account. */
  private async isMember(userId: string, legalEntityId: string): Promise<boolean> {
    return (await this.deps.memberships.findActiveMembership(userId, legalEntityId)) !== null;
  }

  private async detailOf(
    deal: PrivateSaleDealDetail,
    userId: string,
  ): Promise<PartyDealDetail | null> {
    const role = await this.roleOf(deal, userId);
    const view = role ? projectDealForParty(deal, role) : null;
    if (!role || !view) return null;
    const [work, { need, buyerClear }] = await Promise.all([
      this.deps.queries.findWorkSummary(deal.itemSubmissionId),
      this.needsOf(deal, role),
    ]);
    const accepted = this.acceptedBy(deal, role);
    return {
      view,
      work: { title: work?.title ?? "Untitled work", reference: work?.reference ?? "" },
      needs: need,
      termsToAccept: deal.stage === "offer" && !accepted ? this.deps.policy.termsVersion : null,
      payable: role === "buyer" && buyerClear && dealPaymentBlockers(deal).length === 0,
    };
  }

  private acceptedBy(deal: PrivateSaleDealDetail, role: PrivateSalePartyRole): boolean {
    const { termsVersion } = this.deps.policy;
    return termsVersion === null
      ? false
      : termsAcceptance(deal, deal.documents, termsVersion)[role];
  }

  /** The one thing the person has to do next, in order of what unblocks the deal. */
  private async needsOf(
    deal: PrivateSaleDealDetail,
    role: PrivateSalePartyRole,
  ): Promise<{ need: PartyDealNeed | null; buyerClear: boolean }> {
    if (!CHECKED_STAGES.has(deal.stage)) return { need: null, buyerClear: false };
    const clearance = await this.deps.clearance.snapshot({
      dealId: deal.id,
      seller: { legalEntityId: deal.seller.legalEntityId, actingUserId: deal.seller.actingUserId },
      buyer: deal.buyer
        ? { legalEntityId: deal.buyer.legalEntityId, actingUserId: deal.buyer.actingUserId }
        : null,
    });
    const mine = clearance[role];
    const buyerClear = clearance.buyer ? partyIsClear(clearance.buyer) : false;

    if (deal.stage === "offer" && !this.acceptedBy(deal, role) && this.deps.policy.termsVersion) {
      return { need: "accept_terms", buyerClear };
    }
    if (mine && mine.kyc !== "clear") return { need: "verify_identity", buyerClear };
    if (
      role === "buyer" &&
      deal.priceMinor !== null &&
      clearance.buyerSourceOfFunds !== "approved" &&
      sourceOfFundsRequired({
        priceMinor: deal.priceMinor,
        buyerOtherOpenExposureMinor: clearance.buyerOtherOpenExposureMinor,
        thresholdMinor: this.deps.policy.sourceOfFundsThresholdMinor,
      })
    ) {
      return { need: "proof_of_funds", buyerClear };
    }
    if (role === "buyer" && deal.stage === "invoiced") return { need: "pay", buyerClear };
    return { need: null, buyerClear };
  }
}
