import {
  type DealBlocker,
  type DealClearancePort,
  type DealCommand,
  type DealTransitionContext,
  PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
  type PrivateSalePolicy,
  dealBlockers,
  dealStageChangedEvent,
  termsAcceptance,
  transitionDeal,
} from "@auction/domain";
import type {
  IPrivateSaleDealReader,
  IPrivateSaleDealWriter,
} from "@auction/persistence/interfaces";
import type { PrivateSaleDealDetail } from "@auction/types";
import type { IDomainEventSink } from "../domain-event-sink.js";

/** The reads, writes and events one transition uses, so they can share a transaction. */
export type DealTransitionScope = {
  deals: IPrivateSaleDealReader & IPrivateSaleDealWriter;
  events: IDomainEventSink;
};

export type DealTransitionOutcome =
  | { kind: "ok"; deal: PrivateSaleDealDetail }
  | { kind: "not_found" }
  /** Someone changed the deal since it was read. Read it again before retrying. */
  | { kind: "conflict" }
  | { kind: "blocked"; blockers: DealBlocker[] };

export type DealTransitionOptions = {
  actorUserId: string | null;
  cancelReason?: string;
  /** Set by the refund flow once a paid deal's money has been returned. */
  refundRecorded?: boolean;
};

export type DealTransitionDeps = {
  scope: DealTransitionScope;
  clearance: DealClearancePort;
  policy: PrivateSalePolicy;
  now?: () => Date;
};

/**
 * Makes one move of a deal: reads the deal and its checks, asks the state machine, writes the
 * change with its history row and publishes the stage change. The rules live in the domain; this
 * only gathers what they read and carries out what they allow.
 */
export class DealTransitionService {
  constructor(private readonly deps: DealTransitionDeps) {}

  /**
   * What stands in the way of a move right now, for a screen to say why a button is off. Reads the
   * deal and its checks exactly as {@link transition} does, and changes nothing.
   */
  async blockers(
    dealId: string,
    command: DealCommand,
    options: DealTransitionOptions,
    scope: DealTransitionScope = this.deps.scope,
  ): Promise<DealBlocker[] | null> {
    const deal = await scope.deals.findById(dealId);
    if (!deal) return null;
    return dealBlockers(deal, command, await this.contextFor(deal, options));
  }

  async transition(
    dealId: string,
    command: DealCommand,
    options: DealTransitionOptions,
    scope: DealTransitionScope = this.deps.scope,
  ): Promise<DealTransitionOutcome> {
    const deal = await scope.deals.findById(dealId);
    if (!deal) return { kind: "not_found" };

    const result = transitionDeal(deal, command, await this.contextFor(deal, options));
    if (!result.ok) return { kind: "blocked", blockers: result.blockers };

    const written = await scope.deals.applyStageChange(deal.id, deal.version, result.change);
    if (written.kind !== "ok") return { kind: written.kind };

    const event = dealStageChangedEvent(deal, result.change);
    await scope.events.publish({
      aggregateType: PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
      aggregateId: deal.id,
      eventType: event.eventType,
      payload: event.payload,
      actorUserId: options.actorUserId,
      actingLegalEntityId: null,
    });
    return { kind: "ok", deal: written.deal };
  }

  /** What the rules read besides the deal: who, when, the configuration and the checks. */
  private async contextFor(
    deal: PrivateSaleDealDetail,
    options: DealTransitionOptions,
  ): Promise<DealTransitionContext> {
    const clearance = await this.deps.clearance.snapshot({
      dealId: deal.id,
      seller: { legalEntityId: deal.seller.legalEntityId, actingUserId: deal.seller.actingUserId },
      buyer: deal.buyer
        ? { legalEntityId: deal.buyer.legalEntityId, actingUserId: deal.buyer.actingUserId }
        : null,
    });
    const { policy } = this.deps;
    return {
      actorUserId: options.actorUserId,
      now: (this.deps.now ?? (() => new Date()))(),
      policy,
      clearance,
      termsAcceptance:
        policy.termsVersion === null
          ? { seller: false, buyer: false }
          : termsAcceptance(deal, deal.documents, policy.termsVersion),
      ...(options.cancelReason !== undefined ? { cancelReason: options.cancelReason } : {}),
      ...(options.refundRecorded !== undefined ? { refundRecorded: options.refundRecorded } : {}),
    };
  }
}
