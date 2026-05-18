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
import { AuthzError, LotError, PaymentProviderError } from "../lib/errors.js";
import { buildMarketingEventConsent, nowUnixSeconds } from "../lib/marketing-event-factory.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { ILegalEntityNotificationRecipientReader } from "./interfaces/legal-entity-notification-recipients.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { ILotFulfilmentPaymentHook } from "./interfaces/lot-fulfilment-payment-hook.js";
import type { IMarketingEventService } from "./interfaces/marketing-event-service.js";
import type { IPaymentAccountingProvider } from "./interfaces/payment-accounting-provider.js";
import type { IPaymentWriteRepository, PaymentRecord } from "./interfaces/payment-write.js";
import type {
  ILotRepository,
  ISaleRepository,
  IUserRepository,
} from "./interfaces/repositories.js";
import { resolveLegalEntityNotificationRecipients } from "./legal-entity-notification-routing.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";
import { notificationRowToPayload } from "./notification-payload.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import type { NotificationFactory } from "./notification.factory.js";
import { type MyPaymentRowDTO, presentMyPayments } from "./payment-me-presenter.js";
import type { IStripePaymentGateway } from "./stripe/stripe-payment-gateway.js";

/** Seller entity must not be in these states for refund. */
const REFUND_BLOCKED_STATUSES = ["archived", "rejected"];

function gbpAmountToPence(amount: string): number {
  return Math.round(Number.parseFloat(amount) * 100);
}

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
    private readonly accounting: IPaymentAccountingProvider,
    private readonly legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader | null = null,
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
    private readonly marketingEvents: IMarketingEventService | null = null,
  ) {}

  /** Record a pending settlement for a won lot. When Xero is connected, creates an online invoice
   * and returns `checkoutUrl` for redirect to Xero.
   */
  async createPendingForWinner(
    buyerId: string,
    lotId: string,
  ): Promise<Result<{ paymentId: string; checkoutUrl: string | null }, AuthzError | LotError>> {
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

    const existing = await this.payments.findOpenByLotAndBuyer(lotId, buyerId);
    if (existing) {
      await this.lotFulfilmentHooks?.ensureAwaitingPayment(lotId, existing.id);
      if (existing.status === "requires_manual_review") {
        return ok({ paymentId: existing.id, checkoutUrl: null });
      }
      let checkoutUrl: string | null = null;
      if (this.accounting.isConfigured()) {
        checkoutUrl = await this.accounting.getCheckoutUrlIfAny(existing.id);
        if (!checkoutUrl) {
          const buyer = await this.users.findById(buyerId);
          if (buyer?.email) {
            const r = await this.accounting.createCheckoutForWinner({
              paymentId: existing.id,
              lot,
              buyerEmail: buyer.email,
              buyerName: buyer.name,
              amount: existing.amount,
              buyerLegalEntityId: lot.buyerLegalEntityId ?? undefined,
            });
            checkoutUrl = r.checkoutUrl ?? null;
          }
        }
      }
      return ok({ paymentId: existing.id, checkoutUrl });
    }

    const total = await this.totalDue(lot);
    const platformFee = (total * 0.05).toFixed(2);
    const amount = total.toFixed(2);
    const sellerEntity = this.legalEntityRepository
      ? await this.legalEntityRepository.findById(lot.sellerLegalEntityId)
      : null;
    const requiresManualReview = sellerEntity?.status === "archived";

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

    if (requiresManualReview && this.db && this.domainEventPublisher) {
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
          reason: "seller_archived",
        },
        actorUserId: buyerId,
        actingLegalEntityId: lot.buyerLegalEntityId,
      });
    }

    let checkoutUrl: string | null = null;
    if (!requiresManualReview && this.accounting.isConfigured()) {
      const buyer = await this.users.findById(buyerId);
      if (buyer?.email) {
        const r = await this.accounting.createCheckoutForWinner({
          paymentId: created.id,
          lot,
          buyerEmail: buyer.email,
          buyerName: buyer.name,
          amount: created.amount,
          buyerLegalEntityId: lot.buyerLegalEntityId ?? undefined,
        });
        checkoutUrl = r.checkoutUrl ?? null;
      }
    }

    await this.lotFulfilmentHooks?.ensureAwaitingPayment(lotId, created.id);

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

    return ok({ paymentId: created.id, checkoutUrl });
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
    const data = await presentMyPayments(filtered, lotById, this.mediaUrlResolver);
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

    await db.transaction(async (tx) => {
      await this.payments.applyRefundedInTransaction(tx, paymentId, stripeRefundId);
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

    return ok(undefined);
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

    if (!this.db || !this.domainEventPublisher) {
      return err(new PaymentProviderError("Payment capture persistence is not configured", 500));
    }

    const db = this.db;
    const publisher = this.domainEventPublisher;

    const buyerId = p.paidByUserId ?? p.buyerId ?? null;
    const buyer = buyerId ? await this.users.findById(buyerId) : null;

    const purchaseEvent =
      buyerId && this.marketingEvents
        ? {
            name: "Purchase" as const,
            eventId: `payment_captured_${paymentId}`,
            eventTime: nowUnixSeconds(),
            actionSource: "system_generated" as const,
            userIdOrAnon: { kind: "user" as const, userId: buyerId },
            consent: buildMarketingEventConsent(false, false, "legitimate_interest"),
            customData: {
              lotId: p.lotId,
              paymentId: p.id,
              valueMinor: gbpAmountToPence(p.amount),
              currencyCode: "GBP",
            },
          }
        : null;

    await db.transaction(async (tx) => {
      const captureOpts: { stripeChargeId?: string | null } = {};
      if (resolvedChargeId) {
        captureOpts.stripeChargeId = resolvedChargeId;
      }
      await this.payments.applyCapturedInTransaction(tx, paymentId, captureOpts);
      await publisher.publish(tx, {
        aggregateType: "payment",
        aggregateId: paymentId,
        eventType: "payment.captured",
        payload: {
          paymentId: p.id,
          lotId: p.lotId,
          userId: buyerId,
          amountCents: gbpAmountToPence(p.amount),
          capturedAt: new Date().toISOString(),
          stripeIntentId: p.stripePaymentIntentId,
          stripeChargeId: resolvedChargeId,
          buyerName: buyer?.name ?? null,
          buyerEmail: buyer?.email ?? null,
        },
        actorUserId: adminUserId ?? null,
        actingLegalEntityId: p.sellerLegalEntityId ?? null,
      });
      if (purchaseEvent && this.marketingEvents) {
        await this.marketingEvents.stage(purchaseEvent, tx);
      }
    });

    const after = (await this.payments.findById(paymentId)) ?? p;
    await this.dispatchPaymentReceived(after);

    if (purchaseEvent && this.marketingEvents) {
      await this.marketingEvents.enqueue(purchaseEvent);
    }

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
    await this.payments.updateStatus(paymentId, "pending");
    if (this.db && this.domainEventPublisher) {
      await this.domainEventPublisher.publish(this.db, {
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
    }
    return ok(undefined);
  }

  async refundManualReviewPayment(
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
    await this.payments.updateStatus(paymentId, "refunded");
    if (this.db && this.domainEventPublisher) {
      await this.domainEventPublisher.publish(this.db, {
        aggregateType: "payment",
        aggregateId: paymentId,
        eventType: "payment.refunded",
        payload: {
          amount: p.amount,
          currency: "GBP",
          sellerLegalEntityId: p.sellerLegalEntityId ?? null,
          via: "admin_manual_review",
          reason: "seller_archived",
        },
        actorUserId: adminUserId,
        actingLegalEntityId: p.sellerLegalEntityId ?? null,
      });
    }
    return ok(undefined);
  }

  /** Marks a payment captured when Xero reports the linked invoice as paid (webhook / sync).
   * Does not perform admin authorization — only call from trusted integration code.
   */
  async markCapturedFromProviderSync(paymentId: string): Promise<void> {
    const p = await this.payments.findById(paymentId);
    if (!p || p.status === "captured" || p.status === "refunded" || p.status === "cancelled") {
      return;
    }
    await this.payments.updateStatus(paymentId, "captured");
    await this.dispatchPaymentReceived(p);
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

  private async dispatchPaymentReceived(p: PaymentRecord): Promise<void> {
    await this.lotFulfilmentHooks?.onPaymentCaptured(p.lotId, p.id);
    const lot = await this.lots.findById(p.lotId);
    if (lot && this.notificationDispatcher) {
      const paidByUserId = p.paidByUserId ?? p.buyerId;
      if (!paidByUserId) return;
      await this.notificationDispatcher.dispatch(
        paidByUserId,
        notificationRowToPayload(this.notificationFactory.createPaymentReceived(lot, paidByUserId)),
      );
      const financeRecipients = await resolveLegalEntityNotificationRecipients(
        this.legalEntityNotificationRecipients,
        {
          legalEntityId: lot.sellerLegalEntityId,
          fallbackUserId: paidByUserId,
          audience: "finance",
        },
      );
      for (const recipientId of financeRecipients) {
        await this.notificationDispatcher.dispatch(
          recipientId,
          notificationRowToPayload(
            this.notificationFactory.createSellerPaymentReceived(lot, recipientId, p.amount),
          ),
        );
      }
    }
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
