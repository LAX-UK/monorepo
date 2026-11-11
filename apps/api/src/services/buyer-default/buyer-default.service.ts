import {
  type BuyerDefaultBlock,
  type BuyerDefaultOutcome,
  buyerDefaultBlock,
  pickUnderbidder,
} from "@auction/domain";
import type {
  IBuyerDefaultReader,
  IBuyerDefaultRepository,
  ILegalEntityNotificationRecipientReader,
  ILotTransitionRepository,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import { BuyerDefaultConflictError } from "@auction/persistence/interfaces";
import type { IAdminUserSuspender } from "@auction/persistence/interfaces";
import {
  BUYER_DEFAULT_ACCESS,
  type StaffRoles,
  type UserRole,
  userHasAccessTo,
} from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { AuthzError, LotError } from "../../lib/errors.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { ILotJobScheduler } from "../interfaces/job-scheduler.js";
import type { ILotLifecycleRecorder } from "../interfaces/lot-lifecycle-recorder.js";
import type { INotificationFactory } from "../interfaces/notification-factory.js";
import { resolveLegalEntityNotificationRecipients } from "../legal-entity-notification-routing.js";
import { notificationRowToPayload } from "../notification-payload.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";

export type BuyerDefaultInput = {
  outcome: BuyerDefaultOutcome;
  reason: string;
  /** Pause the buyer's bidding with the default. */
  restrictBidding: boolean;
};

export type BuyerDefaultResult = { id: string; outcome: BuyerDefaultOutcome };

export type BuyerDefaultServiceDeps = {
  reader: IBuyerDefaultReader;
  repository: IBuyerDefaultRepository;
  transactionRunner: ITransactionRunner;
  transitions: Pick<ILotTransitionRepository, "resetLotForInventoryReturn">;
  recorder: Pick<ILotLifecycleRecorder, "recordBuyerDefaulted" | "recordReturnedToInventory">;
  suspender: Pick<IAdminUserSuspender, "suspendMany"> | null;
  dispatcher: Pick<NotificationDispatcher, "dispatch"> | null;
  factory: Pick<INotificationFactory, "createBuyerDefaultNotice">;
  recipients: ILegalEntityNotificationRecipientReader | null;
  /** Closes the buyer's open checkout, so they cannot pay for a sale that was cancelled. */
  closeCheckout: ((paymentId: string) => Promise<void>) | null;
  events: IDomainEventSink | null;
  jobScheduler: Pick<ILotJobScheduler, "cancelLotJobs"> | null;
};

const BLOCK_STATUS: Record<BuyerDefaultBlock["code"], number> = {
  not_ended: 409,
  no_winner: 409,
  payment_in_progress: 409,
  held_for_checks: 409,
  open_dispute: 409,
  delivery_started: 409,
  already_cancelled: 409,
  no_underbidder: 422,
};

/**
 * Staff mark a won lot as a buyer default: the unpaid invoice is voided (kept, cancelled), the
 * buyer and the seller are told, and the lot goes back to inventory or is offered on to the
 * next bidder. The rules live in the domain; this service orders the steps, keeps the writes in
 * one transaction and sends the notices afterwards, so a failed notice never undoes the void.
 */
export class BuyerDefaultService {
  constructor(private readonly deps: BuyerDefaultServiceDeps) {}

  async record(
    actor: { userId: string; role: UserRole; staffRoles: StaffRoles | undefined },
    lotId: string,
    input: BuyerDefaultInput,
  ): Promise<Result<BuyerDefaultResult, LotError | AuthzError>> {
    if (!userHasAccessTo(actor.role, actor.staffRoles, BUYER_DEFAULT_ACCESS)) {
      return err(new AuthzError("You do not have permission to record a buyer default", 403));
    }
    const reason = input.reason.trim();
    if (reason.length === 0) return err(new LotError("Enter a reason", 422));

    const facts = await this.deps.reader.readFacts(lotId);
    if (!facts) return err(new LotError("Lot not found", 404));
    const { lot } = facts;

    const underbidder =
      lot.buyerLegalEntityId !== null
        ? pickUnderbidder(facts.bids, lot.buyerLegalEntityId, lot.winnerId ?? undefined)
        : null;
    const block = buyerDefaultBlock(
      {
        lotStatus: lot.status,
        winnerId: lot.winnerId,
        payment: facts.payment ? { status: facts.payment.status } : null,
        fulfilmentStatus: facts.fulfilmentStatus,
        hasOpenDispute: facts.hasOpenDispute,
        underbidder,
      },
      input.outcome,
    );
    if (block) return err(new LotError(block.message, BLOCK_STATUS[block.code], block.code));
    if (!lot.winnerId || !lot.buyerLegalEntityId || !lot.sellerLegalEntityId) {
      return err(new LotError("This lot has no buyer to mark as defaulted.", 409, "no_winner"));
    }
    const { winnerId: buyerId, buyerLegalEntityId, sellerLegalEntityId } = lot;
    const offered = input.outcome === "offered_to_underbidder" ? underbidder : null;

    let recorded: { id: string };
    try {
      recorded = await this.deps.transactionRunner.runInTransaction(async (tx) => {
        const row = await this.deps.repository.record(tx, {
          lotId,
          buyerId,
          buyerLegalEntityId,
          sellerLegalEntityId,
          paymentId: facts.payment?.id ?? null,
          hammerPrice: lot.hammerPrice,
          wonAt: lot.wonAt,
          reason,
          outcome: input.outcome,
          buyerRestricted: input.restrictBidding,
          actorUserId: actor.userId,
        });
        const recording = { id: lot.id, saleId: lot.saleId, sellerLegalEntityId };
        await this.deps.recorder.recordBuyerDefaulted(
          tx,
          recording,
          {
            paymentId: facts.payment?.id ?? null,
            buyerId,
            outcome: input.outcome,
            reason,
            buyerRestricted: input.restrictBidding,
            offeredUserId: offered?.userId ?? null,
          },
          actor.userId,
        );
        if (input.outcome === "returned_to_inventory") {
          await this.deps.transitions.resetLotForInventoryReturn(tx, lotId, "ended");
          await this.deps.recorder.recordReturnedToInventory(
            tx,
            recording,
            { fromStatus: "ended", lastSaleId: lot.saleId, reason },
            actor.userId,
          );
        }
        return row;
      });
    } catch (error) {
      if (error instanceof BuyerDefaultConflictError) {
        return err(new LotError(error.message, 409, "conflict"));
      }
      throw error;
    }

    await this.afterRecorded({
      actor,
      lotId,
      facts,
      input,
      offered,
      buyerId,
      buyerLegalEntityId,
      sellerLegalEntityId,
      reason,
    });
    return ok({ id: recorded.id, outcome: input.outcome });
  }

  /** Everything that can fail without undoing the void: checkout, restriction, notices. */
  private async afterRecorded(ctx: {
    actor: { userId: string };
    lotId: string;
    facts: NonNullable<Awaited<ReturnType<IBuyerDefaultReader["readFacts"]>>>;
    input: BuyerDefaultInput;
    offered: { userId: string; legalEntityId: string; amount: string } | null;
    buyerId: string;
    buyerLegalEntityId: string;
    sellerLegalEntityId: string;
    reason: string;
  }): Promise<void> {
    const { facts, input } = ctx;
    const paymentId = facts.payment?.id ?? null;
    const attempt = async (what: string, step: () => Promise<unknown> | undefined) => {
      try {
        await step();
      } catch (error) {
        console.error(`[BuyerDefaultService] ${what} failed`, ctx.lotId, error);
      }
    };

    if (paymentId && this.deps.closeCheckout) {
      await attempt("closing checkout", () => this.deps.closeCheckout?.(paymentId));
      await attempt("publishing payment.cancelled", () =>
        this.deps.events?.publish({
          aggregateType: "payment",
          aggregateId: paymentId,
          eventType: "payment.cancelled",
          payload: { lotId: ctx.lotId, buyerUserId: ctx.buyerId, reason: "buyer_default" },
          actorUserId: ctx.actor.userId,
          actingLegalEntityId: ctx.buyerLegalEntityId,
        }),
      );
    }
    if (input.outcome === "returned_to_inventory") {
      await attempt("cancelling lot jobs", () => this.deps.jobScheduler?.cancelLotJobs(ctx.lotId));
    }
    if (input.restrictBidding && this.deps.suspender) {
      await attempt("restricting bidding", () =>
        this.deps.suspender?.suspendMany({
          userIds: [ctx.buyerId],
          reason: `Buyer default on ${facts.lot.title}: ${ctx.reason}`,
          actorUserId: ctx.actor.userId,
          bulk: false,
        }),
      );
    }

    if (!this.deps.dispatcher) return;
    const dispatcher = this.deps.dispatcher;
    const notice = (
      userId: string,
      legalEntityId: string | null,
      audience: "buyer" | "seller" | "underbidder",
    ) =>
      dispatcher.dispatch(
        userId,
        notificationRowToPayload(
          this.deps.factory.createBuyerDefaultNotice({
            userId,
            legalEntityId,
            lotId: ctx.lotId,
            lotTitle: facts.lot.title,
            amount: facts.payment?.amount ?? facts.lot.hammerPrice,
            audience,
            outcome: input.outcome,
            buyerRestricted: input.restrictBidding,
          }),
        ),
      );

    await attempt("telling the buyer", () => notice(ctx.buyerId, ctx.buyerLegalEntityId, "buyer"));
    await attempt("telling the seller", async () => {
      const sellers = await resolveLegalEntityNotificationRecipients(this.deps.recipients, {
        legalEntityId: ctx.sellerLegalEntityId,
        fallbackUserId: ctx.sellerLegalEntityId,
        audience: "seller",
      });
      for (const userId of sellers) await notice(userId, ctx.sellerLegalEntityId, "seller");
    });
    const next = ctx.offered;
    if (next) {
      await attempt("telling the next bidder", () =>
        notice(next.userId, next.legalEntityId, "underbidder"),
      );
    }
  }
}
