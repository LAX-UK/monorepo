import type { Database } from "@auction/db";
import { type Lot, type UserRole, roleHasCapability } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { AuthzError, LotError } from "../lib/errors.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { ILegalEntityNotificationRecipientReader } from "./interfaces/legal-entity-notification-recipients.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { IPaymentAccountingProvider } from "./interfaces/payment-accounting-provider.js";
import type { IPaymentWriteRepository, PaymentRecord } from "./interfaces/payment-write.js";
import type { ILotRepository, IUserRepository } from "./interfaces/repositories.js";
import { resolveLegalEntityNotificationRecipients } from "./legal-entity-notification-routing.js";
import { notificationRowToPayload } from "./notification-payload.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import type { NotificationFactory } from "./notification.factory.js";

/** Valid statuses for payment capture. */
const CAPTURABLE_SELLER_STATUSES = ["approved", "restricted", "connect_pending"];

/** Seller entity must not be in these states for refund. */
const REFUND_BLOCKED_STATUSES = ["archived", "rejected"];

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
  ) {}

  /** Record a pending settlement for a won lot. When Xero is connected, creates an online invoice
   * and returns `checkoutUrl` for redirect to Xero. `clientSecret` remains null until a card gateway exists.
   */
  async createPendingForWinner(
    buyerId: string,
    lotId: string,
  ): Promise<
    Result<
      { paymentId: string; clientSecret: string | null; checkoutUrl: string | null },
      AuthzError | LotError
    >
  > {
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
      return ok({ paymentId: existing.id, clientSecret: null, checkoutUrl });
    }

    const total = this.totalDue(lot);
    const platformFee = (total * 0.05).toFixed(2);
    const amount = total.toFixed(2);

    const created = await this.payments.create({
      lotId,
      paidByUserId: buyerId,
      buyerLegalEntityId: lot.buyerLegalEntityId,
      sellerLegalEntityId: lot.sellerLegalEntityId,
      amount,
      platformFee,
      stripePaymentIntentId: null,
    });

    let checkoutUrl: string | null = null;
    if (this.accounting.isConfigured()) {
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

    return ok({ paymentId: created.id, clientSecret: null, checkoutUrl });
  }

  async listAllForAdmin(userRole: string): Promise<Result<PaymentRecord[], AuthzError>> {
    if (!roleHasCapability(userRole as UserRole, "finance.read")) {
      return err(new AuthzError("Forbidden", 403));
    }
    const rows = await this.payments.listAll();
    return ok(rows);
  }

  async listForBuyer(buyerId: string): Promise<PaymentRecord[]> {
    return this.payments.listByBuyerId(buyerId);
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
  ): Promise<Result<void, AuthzError>> {
    const isPlatformFinanceWrite = roleHasCapability(
      userRole as UserRole,
      "finance.platform.write",
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
        return err(
          new AuthzError(
            `Cannot refund: seller entity is ${sellerEntity.status}`,
            400,
          ),
        );
      }
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
          via: "admin_manual",
        },
        actorUserId: adminUserId,
        actingLegalEntityId: p.sellerLegalEntityId ?? null,
      });
    }

    return ok(undefined);
  }

  async markCapturedByAdmin(
    userRole: string,
    paymentId: string,
    actingLegalEntityId?: string | null,
  ): Promise<Result<void, AuthzError>> {
    const isPlatformFinanceWrite = roleHasCapability(
      userRole as UserRole,
      "finance.platform.write",
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
    await this.payments.updateStatus(paymentId, "captured");
    await this.dispatchPaymentReceived(p);
    return ok(undefined);
  }

  /** Marks a payment captured when Xero reports the linked invoice as paid (webhook / sync).
   * Does not perform admin authorization — only call from trusted integration code.
   */
  async markCapturedFromProviderSync(paymentId: string): Promise<void> {
    const p = await this.payments.findById(paymentId);
    if (!p || p.status === "captured" || p.status === "refunded") {
      return;
    }
    await this.payments.updateStatus(paymentId, "captured");
    await this.dispatchPaymentReceived(p);
  }

  async syncPaymentFromXeroAsAdmin(
    userRole: string,
    paymentId: string,
  ): Promise<Result<{ ok: boolean; error?: string }, AuthzError>> {
    if (!roleHasCapability(userRole as UserRole, "finance.platform.write")) {
      return err(new AuthzError("Forbidden", 403));
    }
    const r = await this.accounting.syncPaymentFromProvider(paymentId);
    if (!r.ok) {
      return ok({ ok: false, error: r.error ?? "Xero sync failed" });
    }
    return ok({ ok: true });
  }

  private async dispatchPaymentReceived(p: PaymentRecord): Promise<void> {
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

  private totalDue(lot: Lot): number {
    const hammer = Number.parseFloat(lot.currentPrice);
    const rate = Number.parseFloat(lot.buyerPremiumRate);
    const safeHammer = Number.isFinite(hammer) ? hammer : 0;
    const safeRate = Number.isFinite(rate) ? rate : 0;
    return safeHammer * (1 + safeRate);
  }
}
