import type { LotFulfilmentAddressSnapshot } from "@auction/persistence";
import type { PaymentRecord } from "@auction/persistence";
import type { Lot } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { gbpAmountToPence, gbpPenceToMajorString } from "../../lib/decimal-money.js";
import { AuthzError, LotError, type PaymentProviderError } from "../../lib/errors.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import { notificationRowToPayload } from "../notification-payload.js";
import { resolveCheckoutAddressSnapshot } from "./checkout-address.js";
import { resolveCheckoutForPendingOrPromoteCompliance } from "./checkout-orchestrator.js";
import { formatPaymentDueDateFromCreated } from "./payment-due-date.js";
import type { CreatePendingPaymentResult, PaymentServiceDeps } from "./payment-service-types.js";
import type { CheckoutRailKind, ManualReviewReason } from "./payment-tier.policy.js";
import { resolveNewPaymentReviewDecision } from "./resolve-manual-review-reason.js";
import { computeTotalDuePence } from "./total-due.js";

type ExistingPaymentHandlerContext = {
  deps: PaymentServiceDeps;
  existing: PaymentRecord;
  lot: Lot;
  buyerId: string;
  addressSnapshot: LotFulfilmentAddressSnapshot;
};

type ExistingPaymentHandler = (
  ctx: ExistingPaymentHandlerContext,
) => Promise<Result<CreatePendingPaymentResult, AuthzError | LotError | PaymentProviderError>>;

const TERMINAL_CHECKOUT_RESULT = (
  paymentId: string,
): Result<CreatePendingPaymentResult, AuthzError | LotError | PaymentProviderError> =>
  ok({
    paymentId,
    checkoutUrl: null,
    checkoutRail: null,
    manualReviewReason: null,
  });

export const EXISTING_PAYMENT_STATUS_HANDLERS: Partial<
  Record<PaymentRecord["status"], ExistingPaymentHandler>
> = {
  captured: async ({ existing }) => TERMINAL_CHECKOUT_RESULT(existing.id),
  refunded: async () => err(new LotError("Payment for this lot has already been refunded", 409)),
  authorized: async ({ existing }) => TERMINAL_CHECKOUT_RESULT(existing.id),
  requires_manual_review: handleExistingManualReviewPayment,
};

async function handleExistingManualReviewPayment(
  ctx: ExistingPaymentHandlerContext,
): Promise<Result<CreatePendingPaymentResult, AuthzError | LotError | PaymentProviderError>> {
  const { deps, existing, buyerId } = ctx;
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

async function handleExistingOpenPayment(
  ctx: ExistingPaymentHandlerContext,
): Promise<Result<CreatePendingPaymentResult, AuthzError | LotError | PaymentProviderError>> {
  const { deps, existing, lot, buyerId } = ctx;
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

export async function validateWinnerCanPay(
  deps: PaymentServiceDeps,
  buyerId: string,
  lotId: string,
): Promise<Result<Lot, AuthzError | LotError>> {
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
  return ok(lot);
}

export async function resolvePaymentAddressSnapshot(
  deps: PaymentServiceDeps,
  buyerId: string,
  addressId: string,
): Promise<Result<LotFulfilmentAddressSnapshot, LotError>> {
  try {
    if (!deps.addresses) {
      return err(new LotError("Address service unavailable", 503, "address_service_unavailable"));
    }
    const addressSnapshot = await resolveCheckoutAddressSnapshot(
      deps.addresses,
      buyerId,
      addressId,
    );
    return ok(addressSnapshot);
  } catch (e) {
    if (e instanceof LotError) return err(e);
    throw e;
  }
}

export async function handleExistingPaymentForWinner(
  deps: PaymentServiceDeps,
  lot: Lot,
  buyerId: string,
  addressSnapshot: LotFulfilmentAddressSnapshot,
): Promise<Result<
  CreatePendingPaymentResult,
  AuthzError | LotError | PaymentProviderError
> | null> {
  const existing = await deps.payments.findOpenByLotAndBuyer(lot.id, buyerId);
  if (!existing) return null;

  await deps.lotFulfilmentHooks?.ensureAwaitingPayment(lot.id, existing.id, addressSnapshot);

  const ctx: ExistingPaymentHandlerContext = { deps, existing, lot, buyerId, addressSnapshot };
  const handler = EXISTING_PAYMENT_STATUS_HANDLERS[existing.status] ?? handleExistingOpenPayment;
  return handler(ctx);
}

export async function computeNewPaymentTerms(
  deps: PaymentServiceDeps,
  lot: Lot,
  buyerId: string,
): Promise<
  Result<
    {
      amount: string;
      amountPence: number;
      platformFee: string;
      requiresManualReview: boolean;
      manualReviewReason: ManualReviewReason | null;
    },
    LotError
  >
> {
  const priorRefund = await deps.payments.findRefundedByLotAndBuyer(lot.id, buyerId);
  if (priorRefund) {
    return err(new LotError("Payment for this lot has already been refunded", 409));
  }
  if (!lot.sellerLegalEntityId || !lot.buyerLegalEntityId) {
    return err(new LotError("Winning legal entity is missing for this lot", 400));
  }
  const sellerLegalEntityId = lot.sellerLegalEntityId;

  const amountPence = await computeTotalDuePence(deps.sales, lot);
  const amount = gbpPenceToMajorString(amountPence);
  const platformFee = deps.platformFeePolicy
    ? await deps.platformFeePolicy.computePlatformFeeFromPence(sellerLegalEntityId, amountPence)
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

  return ok({ amount, amountPence, platformFee, requiresManualReview, manualReviewReason });
}

export async function createPaymentRecordForWinner(
  deps: PaymentServiceDeps,
  lot: Lot,
  buyerId: string,
  terms: {
    amount: string;
    platformFee: string;
    requiresManualReview: boolean;
    manualReviewReason: ManualReviewReason | null;
  },
): Promise<PaymentRecord> {
  if (!lot.buyerLegalEntityId || !lot.sellerLegalEntityId) {
    throw new LotError("Winning legal entity is missing for this lot", 400);
  }

  const created = await deps.payments.create({
    lotId: lot.id,
    paidByUserId: buyerId,
    buyerLegalEntityId: lot.buyerLegalEntityId,
    sellerLegalEntityId: lot.sellerLegalEntityId,
    amount: terms.amount,
    platformFee: terms.platformFee,
    stripePaymentIntentId: null,
    status: terms.requiresManualReview ? "requires_manual_review" : "pending",
  });

  if (terms.requiresManualReview && deps.domainEventSink && terms.manualReviewReason) {
    await deps.domainEventSink.publish({
      aggregateType: "payment",
      aggregateId: created.id,
      eventType: "payment.requires_manual_review",
      payload: {
        paymentId: created.id,
        lotId: lot.id,
        buyerUserId: buyerId,
        buyerLegalEntityId: lot.buyerLegalEntityId,
        sellerLegalEntityId: lot.sellerLegalEntityId,
        amount: terms.amount,
        currency: "GBP",
        reason: terms.manualReviewReason,
      },
      actorUserId: buyerId,
      actingLegalEntityId: lot.buyerLegalEntityId ?? null,
    });
  }

  return created;
}

export async function resolveCheckoutForNewPayment(
  deps: PaymentServiceDeps,
  paymentId: string,
  lot: Lot,
  buyerId: string,
  amount: string,
): Promise<
  Result<
    {
      checkoutUrl: string | null;
      checkoutRail: CheckoutRailKind | null;
      manualReviewReason: ManualReviewReason | null;
    },
    PaymentProviderError
  >
> {
  const checkout = await resolveCheckoutForPendingOrPromoteCompliance(
    deps.checkoutOrchestratorDeps,
    paymentId,
    lot,
    buyerId,
    amount,
  );
  if (checkout.isErr()) return err(checkout.error);
  return ok({
    checkoutUrl: checkout.value.checkoutUrl,
    checkoutRail: checkout.value.checkoutRail,
    manualReviewReason: checkout.value.manualReviewReason,
  });
}

export async function finalizePendingPaymentForWinner(
  deps: PaymentServiceDeps,
  lot: Lot,
  buyerId: string,
  created: PaymentRecord,
  addressSnapshot: LotFulfilmentAddressSnapshot,
  checkoutUrl: string | null,
  requiresManualReview: boolean,
): Promise<void> {
  await deps.lotFulfilmentHooks?.ensureAwaitingPayment(lot.id, created.id, addressSnapshot);

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
}

/** Winning bidder initiates Stripe checkout (card or UK bank transfer by amount tier). */
export async function createPendingForWinner(
  deps: PaymentServiceDeps,
  buyerId: string,
  lotId: string,
  addressId: string,
): Promise<Result<CreatePendingPaymentResult, AuthzError | LotError | PaymentProviderError>> {
  const lotResult = await validateWinnerCanPay(deps, buyerId, lotId);
  if (lotResult.isErr()) return err(lotResult.error);
  const lot = lotResult.value;

  const addressResult = await resolvePaymentAddressSnapshot(deps, buyerId, addressId);
  if (addressResult.isErr()) return err(addressResult.error);
  const addressSnapshot = addressResult.value;

  const existingResult = await handleExistingPaymentForWinner(deps, lot, buyerId, addressSnapshot);
  if (existingResult) return existingResult;

  const termsResult = await computeNewPaymentTerms(deps, lot, buyerId);
  if (termsResult.isErr()) return err(termsResult.error);
  const { amount, platformFee, requiresManualReview, manualReviewReason } = termsResult.value;

  const created = await createPaymentRecordForWinner(deps, lot, buyerId, {
    amount,
    platformFee,
    requiresManualReview,
    manualReviewReason,
  });

  let checkoutUrl: string | null = null;
  let checkoutRail: CheckoutRailKind | null = null;
  if (!requiresManualReview) {
    const checkoutResult = await resolveCheckoutForNewPayment(
      deps,
      created.id,
      lot,
      buyerId,
      created.amount,
    );
    if (checkoutResult.isErr()) return err(checkoutResult.error);
    if (checkoutResult.value.manualReviewReason) {
      return ok({
        paymentId: created.id,
        checkoutUrl: null,
        checkoutRail: null,
        manualReviewReason: checkoutResult.value.manualReviewReason,
      });
    }
    checkoutUrl = checkoutResult.value.checkoutUrl;
    checkoutRail = checkoutResult.value.checkoutRail;
  }

  await finalizePendingPaymentForWinner(
    deps,
    lot,
    buyerId,
    created,
    addressSnapshot,
    checkoutUrl,
    requiresManualReview,
  );

  return ok({
    paymentId: created.id,
    checkoutUrl,
    checkoutRail,
    manualReviewReason,
  });
}
