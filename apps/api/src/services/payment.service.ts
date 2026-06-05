import type { Database } from "@auction/db";
import {
  type Lot,
  type PaymentStatus,
  type Sale,
  type UserRole,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import { buildBuyerPremiumPolicy } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import Stripe from "stripe";
import { gbpAmountToPence } from "../lib/decimal-money.js";
import { AuthzError, LotError, PaymentProviderError } from "../lib/errors.js";
import { recordMoneyPathEvent } from "../middleware/metrics.js";
import type { IXeroPaymentRecorder } from "./accounting/xero-payment-recorder.js";
import type { ISettlementCompliancePolicy } from "./aml/settlement-compliance.policy.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IStripeCheckoutService } from "./interfaces/checkout-rail.js";
import type { IInvoiceAccountingProvider } from "./interfaces/invoice-accounting.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { ILotFulfilmentPaymentHook } from "./interfaces/lot-fulfilment-payment-hook.js";
import type { LotFulfilmentAddressSnapshot } from "./interfaces/lot-fulfilment-payment-hook.js";
import type { IMarketingEventService } from "./interfaces/marketing-event-service.js";
import type { IPaymentCaptureService } from "./interfaces/payment-capture.js";
import type { IPaymentWriteRepository, PaymentRecord } from "./interfaces/payment-write.js";
import type { IPayoutAdjustmentService } from "./interfaces/payout-adjustment.js";
import type { IPlatformFeePolicy } from "./interfaces/platform-fee.js";
import type { IAddressRepository } from "./interfaces/profile.js";
import type {
  ILotRepository,
  ISaleRepository,
  IUserRepository,
} from "./interfaces/repositories.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";
import { notificationRowToPayload } from "./notification-payload.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import type { NotificationFactory } from "./notification.factory.js";
import { type MyPaymentRowDTO, presentMyPayments } from "./payment-me-presenter.js";
import { resolveCheckoutAddressSnapshot } from "./payment/checkout-address.js";
import type { PaymentRefundReconcileService } from "./payment/payment-refund-reconcile.service.js";
import type {
  CheckoutRailKind,
  ManualReviewReason,
  PaymentTierPolicy,
} from "./payment/payment-tier.policy.js";
import { manualReviewReasonFromCheckoutBlockCode } from "./payment/resolve-manual-review-reason.js";
import type { IStripePaymentGateway } from "./stripe/stripe-payment-gateway.js";

export type CreatePendingPaymentResult = {
  paymentId: string;
  checkoutUrl: string | null;
  checkoutRail: CheckoutRailKind | null;
  manualReviewReason: ManualReviewReason | null;
};

/** Seller entity must not be in these states for refund. */
const REFUND_BLOCKED_STATUSES = ["archived", "rejected"];

function paymentProviderErrorFromUnknown(e: unknown): PaymentProviderError {
  if (e instanceof Stripe.errors.StripeError) {
    const status =
      e.type === "StripeInvalidRequestError" || e.type === "StripeCardError" ? 400 : 502;
    return new PaymentProviderError(e.message, status, e.code ?? undefined);
  }
  if (e instanceof Error) {
    return new PaymentProviderError(e.message, 502);
  }
  return new PaymentProviderError("Payment provider error", 502);
}

export class PaymentService {
  constructor(
    private readonly lots: ILotRepository,
    private readonly payments: IPaymentWriteRepository,
    private readonly notificationDispatcher: NotificationDispatcher | null,
    private readonly notificationFactory: NotificationFactory,
    private readonly users: IUserRepository,
    private readonly accounting: IInvoiceAccountingProvider,
    private readonly paymentTierPolicy: PaymentTierPolicy,
    private readonly legalEntityRepository?: ILegalEntityRepository,
    private readonly db?: Database,
    private readonly domainEventPublisher?: DomainEventPublisher,
    private readonly stripePayments: IStripePaymentGateway | null = null,
    private readonly mediaUrlResolver?: MediaUrlResolver,
    private readonly lotFulfilmentHooks: ILotFulfilmentPaymentHook | null = null,
    /**
     * Optional sale repository used by `totalDue` to resolve sale-level buyer-premium
     * tiers. When omitted (e.g. older test fixtures) the service falls back to the
     * existing per-lot `buyerPremiumRate` — preserving the previous behaviour exactly.
     */
    private readonly sales: ISaleRepository | null = null,
    _marketingEvents: IMarketingEventService | null = null,
    private readonly platformFeePolicy: IPlatformFeePolicy | null = null,
    private readonly paymentCapture: IPaymentCaptureService | null = null,
    private readonly stripeCheckout: IStripeCheckoutService | null = null,
    private readonly payoutAdjustments: IPayoutAdjustmentService | null = null,
    private readonly paymentRefundReconcile: PaymentRefundReconcileService | null = null,
    private readonly xeroPaymentRecorder: IXeroPaymentRecorder | null = null,
    private readonly addresses: IAddressRepository | null = null,
    /** Pre-settlement AML/SoF compliance gate (CDD Sections 5 & 6). */
    private readonly settlementCompliance: ISettlementCompliancePolicy | null = null,
  ) {}

  /** Winning bidder initiates Stripe checkout (card or UK bank transfer by amount tier). */
  async createPendingForWinner(
    buyerId: string,
    lotId: string,
    addressId: string,
  ): Promise<Result<CreatePendingPaymentResult, AuthzError | LotError | PaymentProviderError>> {
    const lot = await this.lots.findById(lotId);
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
      if (!this.addresses) {
        return err(new LotError("Address service unavailable", 503, "address_service_unavailable"));
      }
      addressSnapshot = await resolveCheckoutAddressSnapshot(this.addresses, buyerId, addressId);
    } catch (e) {
      if (e instanceof LotError) return err(e);
      throw e;
    }

    const existing = await this.payments.findOpenByLotAndBuyer(lotId, buyerId);
    if (existing) {
      await this.lotFulfilmentHooks?.ensureAwaitingPayment(lotId, existing.id, addressSnapshot);
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
      if (existing.status === "requires_manual_review") {
        const amountPence = gbpAmountToPence(existing.amount);
        const sellerEntity =
          this.legalEntityRepository && existing.sellerLegalEntityId
            ? await this.legalEntityRepository.findById(existing.sellerLegalEntityId)
            : null;
        // Prefer the compliance reason (aml_hold / source_of_funds_required) so it
        // is preserved for display/audit; fall back to the value-tier reason.
        const complianceDecision = this.settlementCompliance
          ? await this.settlementCompliance.evaluate({
              buyerUserId: buyerId,
              amountPence,
              excludePaymentId: existing.id,
            })
          : { hold: false, reason: null };
        const manualReviewReason: ManualReviewReason | null = complianceDecision.hold
          ? complianceDecision.reason
          : this.paymentTierPolicy.resolveManualReviewReason(
              amountPence,
              sellerEntity?.status === "archived",
            );
        return ok({
          paymentId: existing.id,
          checkoutUrl: null,
          checkoutRail: null,
          manualReviewReason,
        });
      }
      const checkout = await this.resolveCheckoutForPendingOrPromoteCompliance(
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

    const priorRefund = await this.payments.findRefundedByLotAndBuyer(lotId, buyerId);
    if (priorRefund) {
      return err(new LotError("Payment for this lot has already been refunded", 409));
    }

    const total = await this.totalDue(lot);
    const platformFee = this.platformFeePolicy
      ? await this.platformFeePolicy.computePlatformFee(lot.sellerLegalEntityId, total)
      : (total * 0.05).toFixed(2);
    const amount = total.toFixed(2);
    const amountPence = gbpAmountToPence(amount);
    const amountValidation = this.paymentTierPolicy.validateCheckoutAmountPence(amountPence);
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

    const sellerEntity = this.legalEntityRepository
      ? await this.legalEntityRepository.findById(lot.sellerLegalEntityId)
      : null;
    const sellerArchived = sellerEntity?.status === "archived";

    // CDD Sections 5 & 6: halt settlement on an AML/sanctions hold or when SoF is
    // owed. Reuses the existing manual-review gate rather than a parallel flow.
    const complianceDecision = this.settlementCompliance
      ? await this.settlementCompliance.evaluate({ buyerUserId: buyerId, amountPence })
      : { hold: false, reason: null };

    const tierNeedsReview = this.paymentTierPolicy.needsManualReviewGate(
      amountPence,
      sellerArchived,
    );
    const requiresManualReview = complianceDecision.hold || tierNeedsReview;
    // Compliance reasons take precedence over value-tier reasons for display/audit.
    const manualReviewReason: ManualReviewReason | null = complianceDecision.hold
      ? complianceDecision.reason
      : tierNeedsReview
        ? this.paymentTierPolicy.resolveManualReviewReason(amountPence, sellerArchived)
        : null;
    if (complianceDecision.hold) {
      recordMoneyPathEvent(`settlement_compliance_hold_${complianceDecision.reason}`);
    }

    const created = await this.payments.create({
      lotId,
      paidByUserId: buyerId,
      buyerLegalEntityId: lot.buyerLegalEntityId,
      sellerLegalEntityId: lot.sellerLegalEntityId,
      amount,
      platformFee,
      stripePaymentIntentId: null,
      status: requiresManualReview ? "requires_manual_review" : "pending",
    });

    if (requiresManualReview && this.db && this.domainEventPublisher && manualReviewReason) {
      await this.domainEventPublisher.publish(this.db, {
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
      const checkout = await this.resolveCheckoutForPendingOrPromoteCompliance(
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

    await this.lotFulfilmentHooks?.ensureAwaitingPayment(lotId, created.id, addressSnapshot);

    if (this.notificationDispatcher && !requiresManualReview) {
      await this.notificationDispatcher.dispatch(
        buyerId,
        notificationRowToPayload(
          this.notificationFactory.createPaymentDue(lot, buyerId, {
            paymentId: created.id,
            amount: created.amount,
            checkoutUrl,
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

  async listAllForAdmin(
    userRole: string,
    userStaffRole?: string | null,
  ): Promise<Result<PaymentRecord[], AuthzError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "finance.read",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(new AuthzError("Forbidden", 403));
    }
    const rows = await this.payments.listAll();
    return ok(rows);
  }

  async listForBuyer(buyerId: string): Promise<PaymentRecord[]> {
    return this.payments.listByBuyerId(buyerId);
  }

  /** Buyer dashboard: list, optional status filter, lot hydration, presentation. */
  async listMyPaymentsForBuyerApi(
    userId: string,
    options: { status?: PaymentStatus },
  ): Promise<{ data: MyPaymentRowDTO[] }> {
    const all = await this.listForBuyer(userId);
    const filtered = options.status ? all.filter((p) => p.status === options.status) : all;
    const lotIds = Array.from(new Set(filtered.map((p) => p.lotId)));
    const lots = await Promise.all(lotIds.map((id) => this.lots.findById(id)));
    const lotById = new Map<string, NonNullable<(typeof lots)[number]>>();
    for (const lot of lots) {
      if (lot) lotById.set(lot.id, lot);
    }
    const sellerArchivedByEntityId = new Map<string, boolean>();
    if (this.legalEntityRepository) {
      const legalEntityRepository = this.legalEntityRepository;
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
    const data = await presentMyPayments(filtered, lotById, this.mediaUrlResolver, {
      paymentTierPolicy: this.paymentTierPolicy,
      sellerArchivedByEntityId,
      settlementCompliance: this.settlementCompliance,
    });
    return { data };
  }

  countPendingOlderThanHours(hours: number): Promise<number> {
    return this.payments.countPendingOlderThanHours(hours);
  }

  sumCapturedBetween(start: Date, end: Date): Promise<string> {
    return this.payments.sumCapturedBetween(start, end);
  }

  async refundPayment(
    adminUserId: string,
    userRole: string,
    paymentId: string,
    actingLegalEntityId?: string | null,
    userStaffRole?: string | null,
  ): Promise<Result<void, AuthzError | PaymentProviderError>> {
    const isPlatformFinanceWrite = roleHasCapability(
      userRole as UserRole,
      "finance.platform.write",
      normalizeUserStaffRole(userStaffRole ?? undefined),
    );
    if (!isPlatformFinanceWrite && !actingLegalEntityId) {
      return err(new AuthzError("Forbidden", 403));
    }
    const p = await this.payments.findById(paymentId);
    if (!p) {
      return err(new AuthzError("Payment not found", 404));
    }
    if (
      !isPlatformFinanceWrite &&
      (!p.sellerLegalEntityId || p.sellerLegalEntityId !== actingLegalEntityId)
    ) {
      return err(new AuthzError("Forbidden", 403));
    }
    if (p.status === "refunded") {
      return ok(undefined);
    }

    if (this.legalEntityRepository && p.sellerLegalEntityId) {
      const sellerEntity = await this.legalEntityRepository.findById(p.sellerLegalEntityId);
      if (sellerEntity && REFUND_BLOCKED_STATUSES.includes(sellerEntity.status)) {
        return err(new AuthzError(`Cannot refund: seller entity is ${sellerEntity.status}`, 400));
      }
    }

    if (!p.stripeChargeId) {
      return err(new PaymentProviderError("Cannot refund: payment has no Stripe charge id", 400));
    }
    if (!this.stripePayments?.isConfigured()) {
      return err(
        new PaymentProviderError("Stripe is not configured for this environment", 503, undefined),
      );
    }
    if (!this.db || !this.domainEventPublisher) {
      return err(new PaymentProviderError("Payment refund persistence is not configured", 500));
    }

    const db = this.db;
    const publisher = this.domainEventPublisher;

    let refundOutcome: Awaited<ReturnType<IStripePaymentGateway["createRefund"]>>;
    try {
      refundOutcome = await this.stripePayments.createRefund({
        chargeId: p.stripeChargeId,
        amount: gbpAmountToPence(p.amount),
        reason: "requested_by_customer",
      });
    } catch (e) {
      return err(paymentProviderErrorFromUnknown(e));
    }

    const stripeRefundId = refundOutcome.kind === "created" ? refundOutcome.refundId : null;

    try {
      await db.transaction(async (tx) => {
        const refunded = await this.payments.applyRefundedInTransaction(
          tx,
          paymentId,
          stripeRefundId,
        );
        if (!refunded) {
          return;
        }
        if (this.payoutAdjustments && p.sellerLegalEntityId) {
          const negativeAmount = (-gbpAmountToPence(p.amount) / 100).toFixed(2);
          await this.payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
            legalEntityId: p.sellerLegalEntityId,
            paymentId,
            amount: negativeAmount,
            kind: "refund",
            sourceEventId: `admin_refund:${paymentId}`,
            note: `Admin refund: ${paymentId}`,
            tx,
          });
        }
        await publisher.publish(tx, {
          aggregateType: "payment",
          aggregateId: paymentId,
          eventType: "payment.refunded",
          payload: {
            amount: p.amount,
            currency: "GBP",
            sellerLegalEntityId: p.sellerLegalEntityId ?? null,
            via: "admin_manual",
            stripeRefundId,
          },
          actorUserId: adminUserId,
          actingLegalEntityId: p.sellerLegalEntityId ?? null,
        });
      });
    } catch (persistErr) {
      recordMoneyPathEvent("refund_db_persist_failed");
      if (this.paymentRefundReconcile) {
        await this.paymentRefundReconcile.enqueue({
          paymentId,
          stripeRefundId,
          adminUserId,
          payload: {
            sellerLegalEntityId: p.sellerLegalEntityId ?? null,
            amount: p.amount,
            stripeRefundId,
            via: "admin_manual",
          },
        });
      }
      console.error(
        JSON.stringify({
          msg: "refund_db_persist_failed",
          paymentId,
          stripeRefundId,
          error: persistErr instanceof Error ? persistErr.message : String(persistErr),
        }),
      );
      return err(
        new PaymentProviderError(
          "Stripe refund succeeded but local ledger update failed — manual reconciliation required",
          500,
        ),
      );
    }

    await this.recordXeroRefundCreditNote(paymentId, p.amount, `admin_refund:${paymentId}`);
    return ok(undefined);
  }

  private async promotePendingToComplianceManualReview(
    paymentId: string,
    lot: Lot,
    buyerId: string,
    amount: string,
    reason: ManualReviewReason,
  ): Promise<{
    checkoutUrl: null;
    checkoutRail: null;
    manualReviewReason: ManualReviewReason;
  }> {
    await this.payments.updateStatus(paymentId, "requires_manual_review");
    if (this.db && this.domainEventPublisher) {
      await this.domainEventPublisher.publish(this.db, {
        aggregateType: "payment",
        aggregateId: paymentId,
        eventType: "payment.requires_manual_review",
        payload: {
          paymentId,
          lotId: lot.id,
          buyerUserId: buyerId,
          buyerLegalEntityId: lot.buyerLegalEntityId,
          sellerLegalEntityId: lot.sellerLegalEntityId,
          amount,
          currency: "GBP",
          reason,
        },
        actorUserId: buyerId,
        actingLegalEntityId: lot.buyerLegalEntityId ?? null,
      });
    }
    recordMoneyPathEvent(`settlement_compliance_hold_${reason}`);
    return { checkoutUrl: null, checkoutRail: null, manualReviewReason: reason };
  }

  private async resolveCheckoutForPendingOrPromoteCompliance(
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
    const checkout = await this.issueCheckoutForPendingPayment(paymentId, lot, buyerId, amount);
    if (checkout.isOk()) {
      return ok({
        checkoutUrl: checkout.value.checkoutUrl,
        checkoutRail: checkout.value.checkoutRail,
        manualReviewReason: null,
      });
    }
    const reason = manualReviewReasonFromCheckoutBlockCode(checkout.error.stripeCode);
    if (reason) {
      return ok(
        await this.promotePendingToComplianceManualReview(paymentId, lot, buyerId, amount, reason),
      );
    }
    return err(checkout.error);
  }

  private async issueCheckoutForPendingPayment(
    paymentId: string,
    lot: Lot,
    buyerId: string,
    amount: string,
  ): Promise<
    Result<
      { checkoutUrl: string | null; checkoutRail: CheckoutRailKind | null },
      PaymentProviderError
    >
  > {
    const amountPence = gbpAmountToPence(amount);
    if (this.settlementCompliance) {
      const compliance = await this.settlementCompliance.evaluate({
        buyerUserId: buyerId,
        amountPence,
        excludePaymentId: paymentId,
      });
      if (compliance.hold) {
        const code =
          compliance.reason === "aml_hold"
            ? "payment_checkout_blocked_aml_hold"
            : "payment_checkout_blocked_source_of_funds";
        const message =
          compliance.reason === "aml_hold"
            ? "Checkout is blocked pending AML/sanctions compliance review."
            : "Checkout is blocked until source-of-funds review is complete.";
        return err(new PaymentProviderError(message, 403, code));
      }
    }
    const validation = this.paymentTierPolicy.validateCheckoutAmountPence(amountPence);
    if (validation === "blocked") {
      return err(
        new PaymentProviderError(
          "Payment amount exceeds the maximum online payment limit",
          400,
          "payment_amount_exceeds_limit",
        ),
      );
    }
    if (validation === "invalid_amount") {
      return err(new PaymentProviderError("Invalid payment amount", 400, "invalid_payment_amount"));
    }

    const invoiceResult = await this.ensureXeroInvoiceForPayment(paymentId, lot, buyerId, amount);
    if (!invoiceResult.ok) {
      return err(
        new PaymentProviderError(
          invoiceResult.error ?? "Accounting invoice unavailable",
          503,
          "accounting_unavailable",
        ),
      );
    }

    if (!this.stripeCheckout?.isAvailable()) {
      return err(
        new PaymentProviderError(
          "Stripe checkout is not configured",
          503,
          "stripe_checkout_unavailable",
        ),
      );
    }

    const rail = this.paymentTierPolicy.resolveCheckoutRail(amountPence);
    if (!rail) {
      return err(
        new PaymentProviderError(
          "Checkout is not available for this amount",
          400,
          "invalid_payment_amount",
        ),
      );
    }

    const buyer = await this.users.findById(buyerId);
    if (!buyer?.email) {
      return err(new PaymentProviderError("Buyer email is required for checkout", 400));
    }
    if (!lot.buyerLegalEntityId) {
      return err(new PaymentProviderError("Buyer legal entity is required for checkout", 400));
    }

    const checkout = await this.stripeCheckout.createCheckout(rail, {
      paymentId,
      lot,
      buyerEmail: buyer.email,
      buyerName: buyer.name,
      amount,
      buyerLegalEntityId: lot.buyerLegalEntityId,
      amountPence,
    });

    if (!checkout.checkoutUrl) {
      return err(
        new PaymentProviderError(
          checkout.error ?? "Failed to create Stripe checkout session",
          502,
          checkout.errorCode ?? "stripe_checkout_unavailable",
        ),
      );
    }

    return ok({
      checkoutUrl: checkout.checkoutUrl,
      checkoutRail: checkout.checkoutRail,
    });
  }

  private async ensureXeroInvoiceForPayment(
    paymentId: string,
    lot: Lot,
    buyerId: string,
    amount: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.accounting.isConfigured()) return { ok: true };
    const buyer = await this.users.findById(buyerId);
    if (!buyer?.email) {
      return { ok: false, error: "Buyer email is required for accounting invoice" };
    }
    return this.accounting.ensureInvoiceForPayment({
      paymentId,
      lot,
      buyerEmail: buyer.email,
      buyerName: buyer.name,
      amount,
      buyerLegalEntityId: lot.buyerLegalEntityId ?? undefined,
    });
  }

  private async recordXeroRefundCreditNote(
    paymentId: string,
    amount: string,
    reference: string,
  ): Promise<void> {
    if (!this.xeroPaymentRecorder) return;
    const result = await this.xeroPaymentRecorder.recordRefundCreditNote(
      paymentId,
      amount,
      reference,
    );
    if (!result.ok) {
      recordMoneyPathEvent("xero_refund_credit_note_failed");
    }
  }

  async markCapturedByAdmin(
    adminUserId: string | null | undefined,
    userRole: string,
    paymentId: string,
    actingLegalEntityId?: string | null,
    userStaffRole?: string | null,
  ): Promise<Result<void, AuthzError | PaymentProviderError>> {
    const isPlatformFinanceWrite = roleHasCapability(
      userRole as UserRole,
      "finance.platform.write",
      normalizeUserStaffRole(userStaffRole ?? undefined),
    );
    if (!isPlatformFinanceWrite && !actingLegalEntityId) {
      return err(new AuthzError("Forbidden", 403));
    }
    const p = await this.payments.findById(paymentId);
    if (!p) {
      return err(new AuthzError("Payment not found", 404));
    }
    if (
      !isPlatformFinanceWrite &&
      (!p.sellerLegalEntityId || p.sellerLegalEntityId !== actingLegalEntityId)
    ) {
      return err(new AuthzError("Forbidden", 403));
    }
    if (p.status === "captured") {
      return ok(undefined);
    }
    if (p.status === "requires_manual_review") {
      return err(new AuthzError("Payment requires platform manual review", 409));
    }

    let resolvedChargeId: string | null = p.stripeChargeId;

    if (p.stripePaymentIntentId) {
      if (!this.stripePayments?.isConfigured()) {
        return err(
          new PaymentProviderError("Stripe is not configured for this environment", 503, undefined),
        );
      }
      let pi: Stripe.PaymentIntent;
      try {
        pi = await this.stripePayments.capturePaymentIntent(p.stripePaymentIntentId);
      } catch (e) {
        return err(paymentProviderErrorFromUnknown(e));
      }
      const lc = pi.latest_charge;
      const fromPi =
        typeof lc === "string"
          ? lc
          : lc && typeof lc === "object" && "id" in lc
            ? (lc as Stripe.Charge).id
            : null;
      if (fromPi) {
        resolvedChargeId = fromPi;
      }
    }

    if (!this.paymentCapture) {
      return err(new PaymentProviderError("Payment capture persistence is not configured", 500));
    }

    await this.paymentCapture.capture({
      paymentId,
      via: p.stripePaymentIntentId ? "stripe_payment_intent" : "admin_manual",
      stripeChargeId: resolvedChargeId,
      stripePaymentIntentId: p.stripePaymentIntentId,
      actorUserId: adminUserId ?? null,
    });

    return ok(undefined);
  }

  async releaseManualReviewForCapture(
    adminUserId: string,
    userRole: string,
    paymentId: string,
    userStaffRole?: string | null,
  ): Promise<Result<void, AuthzError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "finance.platform.write",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(new AuthzError("Forbidden", 403));
    }
    const p = await this.payments.findById(paymentId);
    if (!p) {
      return err(new AuthzError("Payment not found", 404));
    }
    if (p.status !== "requires_manual_review") {
      return err(new AuthzError("Payment is not in manual review", 409));
    }
    // CDD: do not release to checkout while AML/SoF settlement compliance still blocks.
    if (this.settlementCompliance) {
      const amountPence = gbpAmountToPence(p.amount);
      const compliance = await this.settlementCompliance.evaluate({
        buyerUserId: p.paidByUserId ?? (p as PaymentRecord & { buyerId?: string }).buyerId ?? "",
        amountPence,
        excludePaymentId: paymentId,
      });
      if (compliance.hold) {
        const code =
          compliance.reason === "aml_hold"
            ? "payment_release_blocked_aml_hold"
            : "payment_release_blocked_source_of_funds";
        const message =
          compliance.reason === "aml_hold"
            ? "Cannot release: buyer is on an AML/sanctions compliance hold. MLRO must clear the screening first."
            : "Cannot release: source-of-funds review is required or pending. Compliance must approve the SoF case first.";
        return err(new AuthzError(message, 403, { code }));
      }
    }
    const db = this.db;
    const publisher = this.domainEventPublisher;
    if (!db || !publisher) {
      await this.payments.updateStatus(paymentId, "pending");
      return ok(undefined);
    }

    try {
      await db.transaction(async (tx) => {
        const released = await this.payments.applyReleasedFromManualReviewInTransaction(
          tx,
          paymentId,
        );
        if (!released) {
          throw new Error("payment_not_in_manual_review");
        }
        await publisher.publish(tx, {
          aggregateType: "payment",
          aggregateId: paymentId,
          eventType: "payment.manual_review_released",
          payload: {
            paymentId,
            lotId: p.lotId,
            sellerLegalEntityId: p.sellerLegalEntityId ?? null,
            action: "capture_and_process",
          },
          actorUserId: adminUserId,
          actingLegalEntityId: p.sellerLegalEntityId ?? null,
        });
      });
    } catch (e) {
      if (e instanceof Error && e.message === "payment_not_in_manual_review") {
        return err(new AuthzError("Payment is not in manual review", 409));
      }
      throw e;
    }
    return ok(undefined);
  }

  async refundManualReviewPayment(
    adminUserId: string,
    userRole: string,
    paymentId: string,
    userStaffRole?: string | null,
  ): Promise<Result<void, AuthzError | PaymentProviderError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "finance.platform.write",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(new AuthzError("Forbidden", 403));
    }
    const p = await this.payments.findById(paymentId);
    if (!p) {
      return err(new AuthzError("Payment not found", 404));
    }
    if (p.status !== "requires_manual_review") {
      return err(new AuthzError("Payment is not in manual review", 409));
    }
    if (!this.db || !this.domainEventPublisher) {
      return err(new PaymentProviderError("Payment refund persistence is not configured", 500));
    }

    const db = this.db;
    const publisher = this.domainEventPublisher;

    let stripeRefundId: string | null = null;
    if (p.stripeChargeId && this.stripePayments?.isConfigured()) {
      try {
        const refundOutcome = await this.stripePayments.createRefund({
          chargeId: p.stripeChargeId,
          amount: gbpAmountToPence(p.amount),
          reason: "requested_by_customer",
        });
        stripeRefundId = refundOutcome.kind === "created" ? refundOutcome.refundId : null;
      } catch (e) {
        return err(paymentProviderErrorFromUnknown(e));
      }
    }

    try {
      await db.transaction(async (tx) => {
        const refunded = await this.payments.applyRefundedInTransaction(
          tx,
          paymentId,
          stripeRefundId,
        );
        if (!refunded) {
          return;
        }
        if (this.payoutAdjustments && p.sellerLegalEntityId) {
          const negativeAmount = (-gbpAmountToPence(p.amount) / 100).toFixed(2);
          await this.payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
            legalEntityId: p.sellerLegalEntityId,
            paymentId,
            amount: negativeAmount,
            kind: "refund",
            sourceEventId: `admin_manual_review_refund:${paymentId}`,
            note: `Manual review refund: ${paymentId}`,
            tx,
          });
        }
        await publisher.publish(tx, {
          aggregateType: "payment",
          aggregateId: paymentId,
          eventType: "payment.refunded",
          payload: {
            amount: p.amount,
            currency: "GBP",
            sellerLegalEntityId: p.sellerLegalEntityId ?? null,
            via: "admin_manual_review",
            reason: "seller_archived",
            stripeRefundId,
          },
          actorUserId: adminUserId,
          actingLegalEntityId: p.sellerLegalEntityId ?? null,
        });
      });
    } catch (persistErr) {
      recordMoneyPathEvent("refund_db_persist_failed");
      if (this.paymentRefundReconcile) {
        await this.paymentRefundReconcile.enqueue({
          paymentId,
          stripeRefundId,
          adminUserId,
          payload: {
            sellerLegalEntityId: p.sellerLegalEntityId ?? null,
            amount: p.amount,
            stripeRefundId,
            via: "admin_manual_review",
          },
        });
      }
      console.error(
        JSON.stringify({
          msg: "refund_db_persist_failed",
          paymentId,
          stripeRefundId,
          via: "admin_manual_review",
          error: persistErr instanceof Error ? persistErr.message : String(persistErr),
        }),
      );
      return err(
        new PaymentProviderError(
          "Stripe refund succeeded but local ledger update failed — manual reconciliation required",
          500,
        ),
      );
    }
    await this.recordXeroRefundCreditNote(
      paymentId,
      p.amount,
      `admin_manual_review_refund:${paymentId}`,
    );
    return ok(undefined);
  }

  /** Buyer abandons an unpaid pending invoice (e.g. relinquishes the win). */
  async cancelPendingAsBuyer(
    buyerId: string,
    paymentId: string,
  ): Promise<Result<void, AuthzError | LotError>> {
    const p = await this.payments.findById(paymentId);
    if (!p) return err(new LotError("Payment not found", 404));
    if (p.paidByUserId !== buyerId) {
      return err(new AuthzError("Only the buyer can cancel this payment", 403));
    }
    if (p.status !== "pending") {
      return err(new LotError("Only pending payments can be cancelled", 409));
    }
    await this.payments.updateStatus(paymentId, "cancelled");
    if (this.db && this.domainEventPublisher) {
      await this.domainEventPublisher.publish(this.db, {
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

  /** Cron: expire pending payments older than `maxAgeDays` (ops recovery for stuck lots). */
  async expireStalePendingPayments(maxAgeDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeDays * 86_400_000);
    const stale = await this.payments.listStalePendingBefore(cutoff);
    for (const row of stale) {
      await this.payments.updateStatus(row.id, "cancelled");
      if (this.db && this.domainEventPublisher) {
        await this.domainEventPublisher.publish(this.db, {
          aggregateType: "payment",
          aggregateId: row.id,
          eventType: "payment.cancelled",
          payload: {
            lotId: row.lotId,
            buyerUserId: row.buyerId,
            reason: "stale_pending_expired",
          },
          actorUserId: null,
          actingLegalEntityId: null,
        });
      }
    }
    return stale.length;
  }

  async syncPaymentFromXeroAsAdmin(
    userRole: string,
    paymentId: string,
    userStaffRole?: string | null,
  ): Promise<Result<{ ok: boolean; error?: string }, AuthzError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "finance.platform.write",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(new AuthzError("Forbidden", 403));
    }
    const r = await this.accounting.syncPaymentFromProvider(paymentId);
    if (!r.ok) {
      return ok({ ok: false, error: r.error ?? "Xero sync failed" });
    }
    return ok({ ok: true });
  }

  /**
   * Hammer + buyer's premium, in major-currency units (e.g. £125.00 → 125).
   *
   * Pricing rule (Strategy + Dependency Inversion):
   *  1. Resolve the parent sale (if a `ISaleRepository` is wired and `lot.saleId` is set).
   *  2. Delegate to `buildBuyerPremiumPolicy({ saleTiers, lotRate })` — a sale with non-empty
   *     `buyerPremiumTiers` overrides the per-lot flat rate; otherwise the existing per-lot
   *     `buyerPremiumRate` is used (back-compat).
   *  3. Add the premium to hammer.
   */
  private async totalDue(lot: Lot): Promise<number> {
    const hammer = Number.parseFloat(lot.currentPrice);
    const safeHammer = Number.isFinite(hammer) ? hammer : 0;
    let sale: Sale | null = null;
    if (this.sales && lot.saleId) {
      sale = await this.sales.findById(lot.saleId).catch(() => null);
    }
    const policy = buildBuyerPremiumPolicy({
      saleTiers: sale?.buyerPremiumTiers ?? null,
      lotRate: lot.buyerPremiumRate,
    });
    const premiumMajor = Number.parseFloat(policy.computePremiumMajor(lot.currentPrice));
    const safePremium = Number.isFinite(premiumMajor) ? premiumMajor : 0;
    return safeHammer + safePremium;
  }
}
