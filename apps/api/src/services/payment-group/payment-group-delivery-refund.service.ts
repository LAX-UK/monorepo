import type {
  DeliveryRefundRequest,
  IPaymentGroupDeliveryRefundRepository,
  IPaymentGroupRepository,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import { type StaffRoles, type UserRole, roleHasCapability } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import { AuthzError, PaymentProviderError } from "../../lib/errors.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import { paymentProviderErrorFromUnknown } from "../payment/payment-service-errors.js";
import type { IChargeRefundsReader } from "../stripe/stripe-charge-refunds.js";
import type { IStripePaymentGateway } from "../stripe/stripe-payment-gateway.js";
import {
  type ChargeRefund,
  isCountedRefund,
  isReturnedNothing,
  isUnsettledRefund,
} from "../stripe/stripe-refund-status.js";

/**
 * The audit event a staff courier refund writes, with who asked, why and for how much. It is
 * written with the request row, before Stripe is asked, so the reason is kept whatever Stripe
 * answers; Stripe's answer is recorded on the row (`payment_group_delivery_refund`).
 */
export const DELIVERY_REFUND_REQUESTED_EVENT = "payment_group.delivery_refund_requested";

export type RefundDeliveryInput = {
  actorUserId: string;
  role: string;
  staffRoles: StaffRoles | undefined;
  paymentGroupId: string;
  deliveryQuoteId: string;
  /** Pence to return; the rest of the courier charge when absent. */
  amountPence?: number;
  /** Why the courier charge goes back; kept on the audit event. */
  reason: string;
};

export type RefundDeliveryOutcome = {
  stripeRefundId: string;
  /** Stripe's status: `succeeded`, or `pending` while the money is on its way back. */
  status: string;
  amountPence: number;
};

export interface IPaymentGroupDeliveryRefunds {
  refundDelivery(
    input: RefundDeliveryInput,
  ): Promise<Result<RefundDeliveryOutcome, AuthzError | PaymentProviderError>>;
}

export type PaymentGroupDeliveryRefundDeps = {
  transactionRunner: ITransactionRunner;
  groups: Pick<IPaymentGroupRepository, "findById" | "lockInTransaction">;
  requests: IPaymentGroupDeliveryRefundRepository;
  stripe: Pick<IStripePaymentGateway, "isConfigured" | "createRefund">;
  /** Every refund Stripe holds on the charge, whatever its status. */
  chargeRefunds: Pick<IChargeRefundsReader, "listChargeRefunds">;
  events: IDomainEventSink;
  /** Now, for how old a request is; tests pin it. */
  now?: () => Date;
};

/**
 * A request still `pending` with no Stripe refund after this long ended without reaching Stripe
 * (its call returned long ago, and Stripe lists no refund naming it), so its amount is freed.
 */
export const UNSENT_REQUEST_RELEASE_MS = 15 * 60 * 1000;

/** A second request for the same amount by the same person this soon is taken as a repeat. */
export const REPEAT_REQUEST_WINDOW_MS = 2 * 60 * 1000;

const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;

type Reservation = {
  request: DeliveryRefundRequest;
  chargeId: string;
  chargedPence: number;
};

/**
 * A staff refund of the courier part of a combined ("Pay several") payment, on its own.
 *
 * The refund is made against the group's charge with `metadata.deliveryQuoteId`, so the refund
 * webhook (`PaymentGroupChargeEvents`) attributes it to the quote and never to an invoice: no
 * seller's payout is clawed back and no invoice's refunded amount moves. Nothing is written to a
 * ledger here; the webhook raises the quote's refunded total once Stripe says the money went back,
 * exactly as for a refund made any other way.
 *
 * Each request is reserved before Stripe is asked: under the group lock, in one transaction, what
 * is left of the courier charge is worked out (counting Stripe's succeeded and pending refunds and
 * every request not known to have failed) and a `pending` request row is written for the amount,
 * with the audit event and the staff reason. Two staff members asking at the same time, for any
 * amounts, are served one after the other, and the second sees the first's amount as taken. The
 * Stripe idempotency key names the request, so a retry of the request is the same refund. A refund
 * Stripe refuses, or that fails or is cancelled, frees its amount, and a new request makes a new
 * refund.
 */
export class PaymentGroupDeliveryRefundService implements IPaymentGroupDeliveryRefunds {
  private readonly now: () => Date;

  constructor(private readonly deps: PaymentGroupDeliveryRefundDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async refundDelivery(
    input: RefundDeliveryInput,
  ): Promise<Result<RefundDeliveryOutcome, AuthzError | PaymentProviderError>> {
    if (!roleHasCapability(input.role as UserRole, "finance.platform.write", input.staffRoles)) {
      return err(new AuthzError("Forbidden", 403));
    }
    if (!this.deps.stripe.isConfigured()) {
      return err(new PaymentProviderError("Stripe is not configured for this environment", 503));
    }
    const found = await this.deps.groups.findById(input.paymentGroupId);
    if (!found) return err(new AuthzError("Payment not found", 404));
    if (found.status !== "paid" || !found.stripeChargeId) {
      return err(new AuthzError("Only a paid payment's courier charge can be refunded", 409));
    }
    // Stripe's refunds are read before the lock is taken (no network call is made under it). A
    // refund made after this read through this service has a request row, which is counted.
    let listed: ChargeRefund[];
    try {
      listed = await this.deps.chargeRefunds.listChargeRefunds(found.stripeChargeId);
    } catch (e) {
      return err(paymentProviderErrorFromUnknown(e));
    }

    const reserved = await this.reserve(input, listed);
    if (reserved.isErr()) return err(reserved.error);
    const { request, chargeId } = reserved.value;

    let outcome: Awaited<ReturnType<IStripePaymentGateway["createRefund"]>>;
    try {
      outcome = await this.deps.stripe.createRefund({
        chargeId,
        amount: request.amountPence,
        reason: "requested_by_customer",
        deliveryQuoteId: request.deliveryQuoteId,
        deliveryRefundId: request.id,
      });
    } catch (e) {
      const providerError = paymentProviderErrorFromUnknown(e);
      if (providerError.status === 400) {
        // Stripe refused the request outright: no refund exists, so the amount is free again.
        await this.recordOutcome(request.id, {
          status: "failed",
          stripeRefundId: null,
          stripeStatus: null,
        });
        recordMoneyPathEvent("delivery_refund_not_made");
        return err(
          new PaymentProviderError(
            `Stripe refused the courier refund (${providerError.message}). Nothing was refunded; you can send it again.`,
            502,
            providerError.stripeCode,
          ),
        );
      }
      // No answer from Stripe: the refund may or may not exist, so its amount stays held.
      recordMoneyPathEvent("delivery_refund_unanswered");
      return err(
        new PaymentProviderError(
          `Stripe did not answer, so it is not known whether ${pounds(request.amountPence)} went back. Check the payment's refunds in Stripe before sending it again; the amount stays held for ${UNSENT_REQUEST_RELEASE_MS / 60_000} minutes.`,
          502,
          providerError.stripeCode,
        ),
      );
    }
    if (outcome.kind === "already_refunded") {
      await this.recordOutcome(request.id, {
        status: "failed",
        stripeRefundId: null,
        stripeStatus: "charge_already_refunded",
      });
      recordMoneyPathEvent("delivery_refund_charge_already_refunded");
      return err(new AuthzError("The payment has already been refunded in full", 409));
    }
    if (isReturnedNothing(outcome.status)) {
      await this.recordOutcome(request.id, {
        status: "failed",
        stripeRefundId: outcome.refundId,
        stripeStatus: outcome.status,
      });
      recordMoneyPathEvent("delivery_refund_not_made");
      return err(
        new PaymentProviderError(
          `Stripe did not make the refund (${outcome.status}). Nothing went back to the buyer and the amount is free again; you can send the refund again.`,
          502,
        ),
      );
    }
    await this.recordOutcome(request.id, {
      status: isCountedRefund(outcome.status) ? "succeeded" : "pending",
      stripeRefundId: outcome.refundId,
      stripeStatus: outcome.status,
    });
    recordMoneyPathEvent("delivery_refund_requested");
    return ok({
      stripeRefundId: outcome.refundId,
      status: outcome.status,
      amountPence: outcome.amountPence,
    });
  }

  /**
   * Under the group lock: works out what is left of the courier charge and, when the request fits,
   * writes the `pending` request row and its audit event, all in one transaction.
   */
  private async reserve(
    input: RefundDeliveryInput,
    listed: readonly ChargeRefund[],
  ): Promise<Result<Reservation, AuthzError>> {
    const now = this.now().getTime();
    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      const locked = await this.deps.groups.lockInTransaction(tx, input.paymentGroupId);
      if (!locked) return err(new AuthzError("Payment not found", 404));
      const { group } = locked;
      const delivery = locked.deliveries.find((d) => d.quoteId === input.deliveryQuoteId) ?? null;
      if (!delivery) {
        return err(new AuthzError("This payment did not charge that courier quote", 404));
      }
      if (group.status !== "paid" || !group.stripeChargeId) {
        return err(new AuthzError("Only a paid payment's courier charge can be refunded", 409));
      }
      const chargeId = group.stripeChargeId;
      const forQuote = listed.filter(
        (r) => r.chargeId === chargeId && r.deliveryQuoteId === delivery.quoteId,
      );
      const stripeTaken = forQuote
        .filter((r) => isCountedRefund(r.status) || isUnsettledRefund(r.status))
        .reduce((sum, r) => sum + r.amountPence, 0);

      // Requests Stripe already lists are counted through Stripe's figure above; every other
      // request still holding its amount (in flight, or made after the list was read) is added.
      const requests = await this.deps.requests.listForQuoteInTransaction(
        tx,
        group.id,
        delivery.quoteId,
      );
      let heldByRequests = 0;
      const recent: DeliveryRefundRequest[] = [];
      for (const request of requests) {
        if (request.status === "failed") continue;
        const refund = forQuote.find(
          (r) =>
            (request.stripeRefundId !== null && r.id === request.stripeRefundId) ||
            r.deliveryRefundId === request.id,
        );
        if (refund) {
          const status = isReturnedNothing(refund.status)
            ? "failed"
            : isCountedRefund(refund.status)
              ? "succeeded"
              : "pending";
          if (
            status !== request.status ||
            refund.id !== request.stripeRefundId ||
            refund.status !== request.stripeStatus
          ) {
            await this.deps.requests.recordOutcome(tx, request.id, {
              status,
              stripeRefundId: refund.id,
              stripeStatus: refund.status,
            });
          }
          if (status !== "failed") recent.push(request);
          continue;
        }
        if (
          request.status === "pending" &&
          request.stripeRefundId === null &&
          now - request.createdAt.getTime() > UNSENT_REQUEST_RELEASE_MS
        ) {
          await this.deps.requests.releaseUnsentInTransaction(tx, request.id);
          continue;
        }
        heldByRequests += request.amountPence;
        recent.push(request);
      }

      const chargedPence = gbpAmountToPence(delivery.amount);
      const alreadyBackPence = Math.max(delivery.refundedPence, stripeTaken + heldByRequests);
      const remainingPence = chargedPence - alreadyBackPence;
      if (remainingPence <= 0) {
        return err(
          new AuthzError(
            heldByRequests > 0
              ? "The rest of the courier charge is already being refunded"
              : "The courier charge has already been refunded",
            409,
          ),
        );
      }
      const amountPence = input.amountPence ?? remainingPence;
      if (!Number.isInteger(amountPence) || amountPence <= 0 || amountPence > remainingPence) {
        return err(
          new AuthzError(
            `Enter an amount up to ${pounds(remainingPence)}, what is left of the courier charge`,
            400,
          ),
        );
      }
      const repeat = recent.find(
        (r) =>
          r.actorUserId === input.actorUserId &&
          r.amountPence === amountPence &&
          now - r.createdAt.getTime() < REPEAT_REQUEST_WINDOW_MS,
      );
      if (repeat) {
        return err(
          new AuthzError(
            `You asked for a courier refund of ${pounds(amountPence)} moments ago. Check the payment's refunds before sending another.`,
            409,
          ),
        );
      }

      const request = await this.deps.requests.insertInTransaction(tx, {
        paymentGroupId: group.id,
        deliveryQuoteId: delivery.quoteId,
        amountPence,
        staffReason: input.reason,
        actorUserId: input.actorUserId,
      });
      await this.deps.events.withTx(tx).publish({
        aggregateType: "payment_group",
        aggregateId: group.id,
        eventType: DELIVERY_REFUND_REQUESTED_EVENT,
        payload: {
          paymentGroupId: group.id,
          deliveryQuoteId: delivery.quoteId,
          deliveryRefundId: request.id,
          stripeChargeId: chargeId,
          amountCents: amountPence,
          chargedCents: chargedPence,
          currency: group.currency,
          staffReason: input.reason,
        },
        actorUserId: input.actorUserId,
        actingLegalEntityId: group.buyerLegalEntityId,
      });
      return ok({ request, chargeId, chargedPence });
    });
  }

  /**
   * Records Stripe's answer on the request. A failure here is not the caller's: the refund's
   * metadata names the request, so the next request for the quote matches it from Stripe's list.
   *
   * This runs outside the payment group's lock on purpose. Stripe has already answered and the
   * row is only this request's own, so the write cannot let another request refund more: while
   * the row is pending or unrecorded the amount stays counted as held (the cap errs on the side
   * of holding it longer), and it is only freed once the outcome says Stripe did not refund it.
   */
  private async recordOutcome(
    id: string,
    outcome: Parameters<IPaymentGroupDeliveryRefundRepository["recordOutcome"]>[2],
  ): Promise<void> {
    try {
      await this.deps.transactionRunner.runInTransaction((tx) =>
        this.deps.requests.recordOutcome(tx, id, outcome),
      );
    } catch {
      recordMoneyPathEvent("delivery_refund_outcome_not_recorded");
    }
  }
}
