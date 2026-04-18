import type { Lot } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { AuthzError, LotError } from "../lib/errors.js";
import type { IPaymentWriteRepository, PaymentRecord } from "./interfaces/payment-write.js";
import type { ILotRepository } from "./interfaces/repositories.js";
import { notificationRowToPayload } from "./notification-payload.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import type { NotificationFactory } from "./notification.factory.js";

export class PaymentService {
  constructor(
    private readonly lots: ILotRepository,
    private readonly payments: IPaymentWriteRepository,
    private readonly notificationDispatcher: NotificationDispatcher | null,
    private readonly notificationFactory: NotificationFactory,
  ) {}

  /**
   * Record a pending settlement for a won lot. No payment processor yet — `clientSecret` is always null
   * until a gateway is integrated (response shape kept for future client compatibility).
   */
  async createPendingForWinner(
    buyerId: string,
    lotId: string,
  ): Promise<Result<{ paymentId: string; clientSecret: string | null }, AuthzError | LotError>> {
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
      return ok({ paymentId: existing.id, clientSecret: null });
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

    return ok({ paymentId: created.id, clientSecret: null });
  }

  async listAllForAdmin(userRole: string): Promise<Result<PaymentRecord[], AuthzError>> {
    if (userRole !== "admin") {
      return err(new AuthzError("Only admins can list payments", 403));
    }
    const rows = await this.payments.listAll();
    return ok(rows);
  }

  async listForBuyer(buyerId: string): Promise<PaymentRecord[]> {
    return this.payments.listByBuyerId(buyerId);
  }

  async refundPayment(
    _adminUserId: string,
    userRole: string,
    paymentId: string,
  ): Promise<Result<void, AuthzError>> {
    if (userRole !== "admin") {
      return err(new AuthzError("Only admins can refund payments", 403));
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
    if (userRole !== "admin") {
      return err(new AuthzError("Only admins can confirm payment capture", 403));
    }
    const p = await this.payments.findById(paymentId);
    if (!p) {
      return err(new AuthzError("Payment not found", 404));
    }
    if (p.status === "captured") {
      return ok(undefined);
    }
    await this.payments.updateStatus(paymentId, "captured");
    const lot = await this.lots.findById(p.lotId);
    if (lot && this.notificationDispatcher) {
      await this.notificationDispatcher.dispatch(
        p.buyerId,
        notificationRowToPayload(this.notificationFactory.createPaymentReceived(lot, p.buyerId)),
      );
    }
    return ok(undefined);
  }

  private totalDue(lot: Lot): number {
    const hammer = Number.parseFloat(lot.currentPrice);
    const rate = Number.parseFloat(lot.buyerPremiumRate);
    const safeHammer = Number.isFinite(hammer) ? hammer : 0;
    const safeRate = Number.isFinite(rate) ? rate : 0;
    return safeHammer * (1 + safeRate);
  }
}
