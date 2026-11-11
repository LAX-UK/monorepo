import type { Database } from "@auction/db";
import {
  type DealBlocker,
  type DealClearancePort,
  type DealCommand,
  type DealTransitionContext,
  PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
  type PrivateSalePolicy,
  dealArtworkRecordNotUpdatedEvent,
  dealBlockers,
  dealStageChangedEvent,
  termsAcceptance,
  transitionDeal,
} from "@auction/domain";
import type {
  IPrivateSaleDealReader,
  IPrivateSaleDealWriter,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import type { PrivateSaleDealDetail } from "@auction/types";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import {
  type IDealRegisterLock,
  REGISTER_EFFECT_BY_STAGE,
  staffOrSystem,
} from "./deal-register-lock.js";

/** The reads, writes and events one transition uses, so they can share a transaction. */
export type DealTransitionScope = {
  deals: IPrivateSaleDealReader & IPrivateSaleDealWriter;
  events: IDomainEventSink;
  /**
   * The artwork register, bound to the same transaction as the rest of the scope. Absent where
   * deals are not tied to the register.
   */
  register?: IDealRegisterLock;
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
  /** How the work was handed over, kept with a release. */
  releaseNote?: string;
  /** Set by the refund flow once a paid deal's money has been returned. */
  refundRecorded?: boolean;
  /** The version the person was looking at; the move is refused as a conflict if the deal has moved on. */
  expectedVersion?: number;
};

export type DealTransitionDeps = {
  scope: DealTransitionScope;
  /**
   * Runs a move that was not given a transaction in one of its own, so the stage, its event and
   * the register change commit together or not at all.
   */
  inTransaction?: {
    runner: ITransactionRunner;
    scopeForTx: (tx: Database) => DealTransitionScope;
  };
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
    scope?: DealTransitionScope,
  ): Promise<DealTransitionOutcome> {
    if (scope) return this.move(dealId, command, options, scope);
    const own = this.deps.inTransaction;
    if (!own) return this.move(dealId, command, options, this.deps.scope);
    return own.runner.runInTransaction((tx) =>
      this.move(dealId, command, options, own.scopeForTx(tx)),
    );
  }

  private async move(
    dealId: string,
    command: DealCommand,
    options: DealTransitionOptions,
    scope: DealTransitionScope,
  ): Promise<DealTransitionOutcome> {
    const deal = await scope.deals.findById(dealId);
    if (!deal) return { kind: "not_found" };

    if (options.expectedVersion !== undefined && options.expectedVersion !== deal.version) {
      return { kind: "conflict" };
    }
    const result = transitionDeal(deal, command, await this.contextFor(deal, options));
    if (!result.ok) return { kind: "blocked", blockers: result.blockers };

    // The write is conditional on the version the person saw, not only the one read just now.
    const written = await scope.deals.applyStageChange(
      deal.id,
      options.expectedVersion ?? deal.version,
      result.change,
    );
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
    await this.followInRegister(scope, deal, result.change.to, options.actorUserId);
    return { kind: "ok", deal: written.deal };
  }

  /** Carries the new stage to the artwork register, when the deal has an artwork and the stage matters there. */
  private async followInRegister(
    scope: DealTransitionScope,
    deal: PrivateSaleDealDetail,
    stage: PrivateSaleDealDetail["stage"],
    actorUserId: string | null,
  ): Promise<void> {
    const effect = REGISTER_EFFECT_BY_STAGE[stage];
    if (!effect || !scope.register || !deal.artworkRegisterId) return;
    try {
      const status = await scope.register[effect.move](
        deal.artworkRegisterId,
        deal.id,
        staffOrSystem(actorUserId),
      );
      if (status === "skipped" && !effect.blocking) {
        await this.reportRegisterNotFollowed(scope, deal, stage, "skipped", status);
      }
    } catch (error) {
      if (effect.blocking) throw error;
      await this.reportRegisterNotFollowed(
        scope,
        deal,
        stage,
        "failed",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /** The deal moved on but the register did not: kept as an event in the same transaction, counted and logged. */
  private async reportRegisterNotFollowed(
    scope: DealTransitionScope,
    deal: PrivateSaleDealDetail,
    stage: PrivateSaleDealDetail["stage"],
    reason: "skipped" | "failed",
    detail: string,
  ): Promise<void> {
    recordMoneyPathEvent("private_sale_register_follow_failed");
    console.error(
      JSON.stringify({
        msg: "private_sale_register_follow_failed",
        dealId: deal.id,
        registerId: deal.artworkRegisterId,
        stage,
        reason,
        detail,
      }),
    );
    const event = dealArtworkRecordNotUpdatedEvent(deal, { stage, reason });
    await scope.events.publish({
      aggregateType: PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
      aggregateId: deal.id,
      eventType: event.eventType,
      payload: event.payload,
      actorUserId: null,
      actingLegalEntityId: null,
    });
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
      ...(options.releaseNote !== undefined ? { releaseNote: options.releaseNote } : {}),
      ...(options.refundRecorded !== undefined ? { refundRecorded: options.refundRecorded } : {}),
    };
  }
}
