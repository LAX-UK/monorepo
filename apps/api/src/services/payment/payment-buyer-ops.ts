import type { LotFulfilmentAddressSnapshot } from "@auction/persistence";
import type { PaymentStatus } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { gbpAmountToPence, gbpPenceToMajorString } from "../../lib/decimal-money.js";
import { AuthzError, LotError, type PaymentProviderError } from "../../lib/errors.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import { notificationRowToPayload } from "../notification-payload.js";
import { type MyPaymentRowDTO, presentMyPayments } from "../payment-me-presenter.js";
import { resolveCheckoutAddressSnapshot } from "./checkout-address.js";
import {
  resolveCheckoutForPendingOrPromoteCompliance,
  revokeOpenStripeCheckoutForPayment,
} from "./checkout-orchestrator.js";
import { formatPaymentDueDateFromCreated } from "./payment-due-date.js";
import type { CreatePendingPaymentResult, PaymentServiceDeps } from "./payment-service-types.js";
import type { CheckoutRailKind, ManualReviewReason } from "./payment-tier.policy.js";
import { resolveNewPaymentReviewDecision } from "./resolve-manual-review-reason.js";
import { computeTotalDuePence } from "./total-due.js";

/** Winning bidder initiates Stripe checkout (card or UK bank transfer by amount tier). */
export async function createPendingForWinner(
  deps: PaymentServiceDeps,
  buyerId: string,
  lotId: string,
  addressId: string,
): Promise<Result<CreatePendingPaymentResult, AuthzError | LotError | PaymentProviderError>> {
  const lot = await deps.lots.findById(lotId);
  if (!lot) {
    return err(new LotError("Lot not found", 404));
  }
  if (lot.winnerId !== buyerId) {
    return err(new AuthzError("Only the winning bidder can initiate payment", 403));
  }
  if (lot.status !== "ended") {
    return err(new AuthzError("Lot must be ended before payment", 400));
  }
  if (!lot.buyerLegalEntityId) {
    return err(new AuthzError("Winning legal entity is missing for this lot", 400));
  }
  if (!lot.sellerLegalEntityId) {
    return err(new AuthzError("Seller legal entity is missing for this lot", 400));
  }

  let addressSnapshot: LotFulfilmentAddressSnapshot;
  try {
    if (!deps.addresses) {
      return err(new LotError("Address service unavailable", 503, "address_service_unavailable"));
    }
    addressSnapshot = await resolveCheckoutAddressSnapshot(deps.addresses, buyerId, addressId);
  } catch (e) {
    if (e instanceof LotError) return err(e);
    throw e;
  }

  const existing = await deps.payments.findOpenByLotAndBuyer(lotId, buyerId);
  if (existing) {
    await deps.lotFulfilmentHooks?.ensureAwaitingPayment(lotId, existing.id, addressSnapshot);
    if (existing.status === "captured") {
      return ok({
        paymentId: existing.id,
        checkoutUrl: null,
        checkoutRail: null,
        manualReviewReason: null,
      });
    }
    if (existing.status === "refunded") {
      return err(new LotError("Payment for this lot has already been refunded", 409));
    }
    if (existing.status === "authorized") {
      return ok({
        paymentId: existing.id,
        checkoutUrl: null,
        checkoutRail: null,
        manualReviewReason: null,
      });
    }
    if (existing.status === "requires_manual_review") {
      const amountPence = gbpAmountToPence(existing.amount);
      const sellerEntity =
        deps.legalEntityRepository && existing.sellerLegalEntityId
          ? await deps.legalEntityRepository.findById(existing.sellerLegalEntityId)
          : null;
      const complianceDecision = deps.settlementCompliance
        ? await deps.settlementCompliance.evaluate({
            buyerUserId: buyerId,
            amountPence,
            excludePaymentId: existing.id,
          })
        : { hold: false, reason: null };
      const manualReviewReason: ManualReviewReason = complianceDecision.hold
        ? (complianceDecision.reason as ManualReviewReason)
        : (deps.paymentTierPolicy.resolveManualReviewReason(
            amountPence,
            sellerEntity?.status === "archived",
          ) ?? "finance_release_required");
      return ok({
        paymentId: existing.id,
        checkoutUrl: null,
        checkoutRail: null,
        manualReviewReason,
      });
    }
    const checkout = await resolveCheckoutForPendingOrPromoteCompliance(
      deps.checkoutOrchestratorDeps,
      existing.id,
      lot,
      buyerId,
      existing.amount,
    );
    if (checkout.isErr()) return err(checkout.error);
    return ok({
      paymentId: existing.id,
      checkoutUrl: checkout.value.checkoutUrl,
      checkoutRail: checkout.value.checkoutRail,
      manualReviewReason: checkout.value.manualReviewReason,
    });
  }

  const priorRefund = await deps.payments.findRefundedByLotAndBuyer(lotId, buyerId);
  if (priorRefund) {
    return err(new LotError("Payment for this lot has already been refunded", 409));
  }

  const amountPence = await computeTotalDuePence(deps.sales, lot);
  const amount = gbpPenceToMajorString(amountPence);
  const platformFee = deps.platformFeePolicy
    ? await deps.platformFeePolicy.computePlatformFeeFromPence(lot.sellerLegalEntityId, amountPence)
    : gbpPenceToMajorString(Math.round(amountPence * 0.05));
  const amountValidation = deps.paymentTierPolicy.validateCheckoutAmountPence(amountPence);
  if (amountValidation === "blocked") {
    return err(
      new LotError(
        "Payment amount exceeds the maximum online payment limit. Contact settlements.",
        400,
        "payment_amount_exceeds_limit",
      ),
    );
  }
  if (amountValidation === "invalid_amount") {
    return err(new LotError("Invalid payment amount", 400, "invalid_payment_amount"));
  }

  const sellerLegalEntityId = lot.sellerLegalEntityId;
  const sellerEntity =
    deps.legalEntityRepository && sellerLegalEntityId
      ? await deps.legalEntityRepository.findById(sellerLegalEntityId)
      : null;
  const sellerArchived = sellerEntity?.status === "archived";

  const reviewDecision = await resolveNewPaymentReviewDecision({
    buyerUserId: buyerId,
    amountPence,
    sellerArchived,
    paymentTierPolicy: deps.paymentTierPolicy,
    settlementCompliance: deps.settlementCompliance,
  });
  const { requiresManualReview, manualReviewReason } = reviewDecision;
  if (reviewDecision.complianceHold && manualReviewReason) {
    recordMoneyPathEvent(`settlement_compliance_hold_${manualReviewReason}`);
  }

  const created = await deps.payments.create({
    lotId,
    paidByUserId: buyerId,
    buyerLegalEntityId: lot.buyerLegalEntityId,
    sellerLegalEntityId: lot.sellerLegalEntityId,
    amount,
    platformFee,
    stripePaymentIntentId: null,
    status: requiresManualReview ? "requires_manual_review" : "pending",
  });

  if (requiresManualReview && deps.domainEventSink && manualReviewReason) {
    await deps.domainEventSink.publish({
      aggregateType: "payment",
      aggregateId: created.id,
      eventType: "payment.requires_manual_review",
      payload: {
        paymentId: created.id,
        lotId,
        buyerUserId: buyerId,
        buyerLegalEntityId: lot.buyerLegalEntityId,
        sellerLegalEntityId: lot.sellerLegalEntityId,
        amount,
        currency: "GBP",
        reason: manualReviewReason,
      },
      actorUserId: buyerId,
      actingLegalEntityId: lot.buyerLegalEntityId,
    });
  }

  let checkoutUrl: string | null = null;
  let checkoutRail: CheckoutRailKind | null = null;
  if (!requiresManualReview) {
    const checkout = await resolveCheckoutForPendingOrPromoteCompliance(
      deps.checkoutOrchestratorDeps,
      created.id,
      lot,
      buyerId,
      created.amount,
    );
    if (checkout.isErr()) return err(checkout.error);
    if (checkout.value.manualReviewReason) {
      return ok({
        paymentId: created.id,
        checkoutUrl: null,
        checkoutRail: null,
        manualReviewReason: checkout.value.manualReviewReason,
      });
    }
    checkoutUrl = checkout.value.checkoutUrl;
    checkoutRail = checkout.value.checkoutRail;
  }

  await deps.lotFulfilmentHooks?.ensureAwaitingPayment(lotId, created.id, addressSnapshot);

  if (deps.notificationDispatcher && !requiresManualReview) {
    const dueDate = formatPaymentDueDateFromCreated(created.createdAt);
    await deps.notificationDispatcher.dispatch(
      buyerId,
      notificationRowToPayload(
        deps.notificationFactory.createPaymentDue(lot, buyerId, {
          paymentId: created.id,
          amount: created.amount,
          checkoutUrl,
          dueDate,
        }),
      ),
    );
  }

  return ok({
    paymentId: created.id,
    checkoutUrl,
    checkoutRail,
    manualReviewReason,
  });
}

export async function listForBuyer(
  deps: PaymentServiceDeps,
  buyerId: string,
): Promise<import("@auction/persistence").PaymentRecord[]> {
  return deps.payments.listByBuyerId(buyerId);
}

/** Buyer dashboard: list, optional status filter, lot hydration, presentation. */
export async function listMyPaymentsForBuyerApi(
  deps: PaymentServiceDeps,
  userId: string,
  options: { status?: PaymentStatus },
): Promise<{ data: MyPaymentRowDTO[] }> {
  const all = await listForBuyer(deps, userId);
  const filtered = options.status ? all.filter((p) => p.status === options.status) : all;
  const lotIds = Array.from(new Set(filtered.map((p) => p.lotId)));
  const lots = await Promise.all(lotIds.map((id) => deps.lots.findById(id)));
  const lotById = new Map<string, NonNullable<(typeof lots)[number]>>();
  for (const lot of lots) {
    if (lot) lotById.set(lot.id, lot);
  }
  const sellerArchivedByEntityId = new Map<string, boolean>();
  if (deps.legalEntityRepository) {
    const legalEntityRepository = deps.legalEntityRepository;
    const sellerIds = Array.from(
      new Set(
        filtered
          .map((p) => p.sellerLegalEntityId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    );
    await Promise.all(
      sellerIds.map(async (id) => {
        const entity = await legalEntityRepository.findById(id);
        if (entity) sellerArchivedByEntityId.set(id, entity.status === "archived");
      }),
    );
  }
  const data = await presentMyPayments(filtered, lotById, deps.mediaUrlResolver, {
    paymentTierPolicy: deps.paymentTierPolicy,
    sellerArchivedByEntityId,
    settlementCompliance: deps.settlementCompliance,
  });
  return { data };
}

/**
 * Pre-flight read-only compliance gate for buyer surfaces. Surfaces an active
 * AML hold or an open (pending) Source-of-Funds case without creating a
 * payment row and without any side effects (no SoF case creation, no events) —
 * safe to call from GET handlers on every checkout/portfolio load.
 */
export async function getBuyerComplianceGateStatus(
  deps: PaymentServiceDeps,
  userId: string,
): Promise<{ status: "clear" | "aml_hold" | "source_of_funds_required" }> {
  if (!deps.settlementCompliance) return { status: "clear" };
  const decision = await deps.settlementCompliance.peek(userId);
  if (decision.hold) {
    const reason = decision.reason;
    if (reason === "aml_hold" || reason === "source_of_funds_required") {
      return { status: reason };
    }
  }
  return { status: "clear" };
}

/** Buyer abandons an unpaid pending invoice (e.g. relinquishes the win). */
export async function cancelPendingAsBuyer(
  deps: PaymentServiceDeps,
  buyerId: string,
  paymentId: string,
): Promise<Result<void, AuthzError | LotError>> {
  const p = await deps.payments.findById(paymentId);
  if (!p) return err(new LotError("Payment not found", 404));
  if (p.paidByUserId !== buyerId) {
    return err(new AuthzError("Only the buyer can cancel this payment", 403));
  }
  if (p.status !== "pending") {
    return err(new LotError("Only pending payments can be cancelled", 409));
  }
  await deps.payments.updateStatus(paymentId, "cancelled");
  await revokeOpenStripeCheckoutForPayment(deps.checkoutOrchestratorDeps, paymentId);
  if (deps.domainEventSink) {
    await deps.domainEventSink.publish({
      aggregateType: "payment",
      aggregateId: paymentId,
      eventType: "payment.cancelled",
      payload: {
        lotId: p.lotId,
        buyerUserId: buyerId,
        reason: "buyer_abandoned",
      },
      actorUserId: buyerId,
      actingLegalEntityId: p.buyerLegalEntityId ?? null,
    });
  }
  return ok(undefined);
}

/** Cron: expire pending and authorized payments older than configured thresholds. */
export async function expireStalePendingPayments(
  deps: PaymentServiceDeps,
  pendingMaxAgeDays: number,
  authorizedMaxAgeDays?: number,
): Promise<number> {
  const pendingCutoff = new Date(Date.now() - pendingMaxAgeDays * 86_400_000);
  const stalePending = await deps.payments.listStalePendingBefore(pendingCutoff);
  const authorizedDays = authorizedMaxAgeDays ?? pendingMaxAgeDays * 2;
  const authorizedCutoff = new Date(Date.now() - authorizedDays * 86_400_000);
  const staleAuthorized = await deps.payments.listStaleAuthorizedBefore(authorizedCutoff);
  let expired = 0;
  for (const row of stalePending) {
    await cancelStalePayment(deps, row, "stale_pending_expired");
    expired += 1;
  }
  for (const row of staleAuthorized) {
    await cancelStalePayment(deps, row, "stale_authorized_expired");
    expired += 1;
  }
  return expired;
}

async function cancelStalePayment(
  deps: PaymentServiceDeps,
  row: { id: string; lotId: string; buyerId: string },
  reason: string,
): Promise<void> {
  await deps.payments.updateStatus(row.id, "cancelled");
  await revokeOpenStripeCheckoutForPayment(deps.checkoutOrchestratorDeps, row.id);
  if (deps.domainEventSink) {
    await deps.domainEventSink.publish({
      aggregateType: "payment",
      aggregateId: row.id,
      eventType: "payment.cancelled",
      payload: {
        lotId: row.lotId,
        buyerUserId: row.buyerId,
        reason,
      },
      actorUserId: null,
      actingLegalEntityId: null,
    });
  }
}
