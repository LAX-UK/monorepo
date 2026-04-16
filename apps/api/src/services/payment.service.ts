import type { Auction } from "@auction/types";
import { err, ok, type Result } from "neverthrow";
import { AuctionError, AuthzError } from "../lib/errors.js";
import type { IAuctionRepository } from "./interfaces/repositories.js";
import type { IPaymentWriteRepository, PaymentRecord } from "./interfaces/payment-write.js";

export class PaymentService {
  constructor(
    private readonly auctions: IAuctionRepository,
    private readonly payments: IPaymentWriteRepository,
  ) {}

  /**
   * Record a pending settlement for a won lot. No payment processor yet — `clientSecret` is always null
   * until a gateway is integrated (response shape kept for future client compatibility).
   */
  async createPendingForWinner(
    buyerId: string,
    auctionId: string,
  ): Promise<Result<{ paymentId: string; clientSecret: string | null }, AuthzError | AuctionError>> {
    const auction = await this.auctions.findById(auctionId);
    if (!auction) {
      return err(new AuctionError("Auction not found", 404));
    }
    if (auction.winnerId !== buyerId) {
      return err(new AuthzError("Only the winning bidder can initiate payment", 403));
    }
    if (auction.status !== "ended") {
      return err(new AuthzError("Auction must be ended before payment", 400));
    }

    const existing = await this.payments.findOpenByAuctionAndBuyer(auctionId, buyerId);
    if (existing) {
      return ok({ paymentId: existing.id, clientSecret: null });
    }

    const total = this.totalDue(auction);
    const platformFee = (total * 0.05).toFixed(2);
    const amount = total.toFixed(2);

    const created = await this.payments.create({
      auctionId,
      buyerId,
      sellerId: auction.sellerId,
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

  private totalDue(auction: Auction): number {
    const hammer = Number.parseFloat(auction.currentPrice);
    const rate = Number.parseFloat(auction.buyerPremiumRate);
    const safeHammer = Number.isFinite(hammer) ? hammer : 0;
    const safeRate = Number.isFinite(rate) ? rate : 0;
    return safeHammer * (1 + safeRate);
  }
}
