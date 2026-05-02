import { type Lot, type UserRole, roleHasCapability } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { AuthzError, LotError } from "../lib/errors.js";
import type { IPaymentAccountingProvider } from "./interfaces/payment-accounting-provider.js";
import type { IPaymentWriteRepository, PaymentRecord } from "./interfaces/payment-write.js";
import type { ILotRepository, IUserRepository } from "./interfaces/repositories.js";
import { notificationRowToPayload } from "./notification-payload.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import type { NotificationFactory } from "./notification.factory.js";

export class PaymentService {
  constructor(
    private readonly lots: ILotRepository,
    private readonly payments: IPaymentWriteRepository,
    private readonly notificationDispatcher: NotificationDispatcher | null,
    private readonly notificationFactory: NotificationFactory,
    private readonly users: IUserRepository,
    private readonly accounting: IPaymentAccountingProvider,
  ) {}

  /**
   * Record a pending settlement for a won lot. When Xero is connected, creates an online invoice
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
      buyerId,
      sellerId: lot.sellerId,
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
    _adminUserId: string,
    userRole: string,
    paymentId: string,
  ): Promise<Result<void, AuthzError>> {
    if (!roleHasCapability(userRole as UserRole, "finance.write")) {
      return err(new AuthzError("Forbidden", 403));
    }
    const p = await this.payments.findById(paymentId);
    if (!p) {
      return err(new AuthzError("Payment not found", 404));
    }
    if (p.status === "refunded") {
      return ok(undefined);
    }
    await this.payments.updateStatus(paymentId, "refunded");
    return ok(undefined);
  }

  async markCapturedByAdmin(
    userRole: string,
    paymentId: string,
  ): Promise<Result<void, AuthzError>> {
    if (!roleHasCapability(userRole as UserRole, "finance.write")) {
      return err(new AuthzError("Forbidden", 403));
    }
    const p = await this.payments.findById(paymentId);
    if (!p) {
      return err(new AuthzError("Payment not found", 404));
    }
    if (p.status === "captured") {
      return ok(undefined);
    }
    await this.payments.updateStatus(paymentId, "captured");
    await this.dispatchPaymentReceived(p);
    return ok(undefined);
  }

  /**
   * Marks a payment captured when Xero reports the linked invoice as paid (webhook / sync).
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
    if (!roleHasCapability(userRole as UserRole, "finance.write")) {
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
      await this.notificationDispatcher.dispatch(
        p.buyerId,
        notificationRowToPayload(this.notificationFactory.createPaymentReceived(lot, p.buyerId)),
      );
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
