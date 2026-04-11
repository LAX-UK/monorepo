import type { Auction } from "@auction/types";
import { err, ok, type Result } from "neverthrow";
import { AuctionError, AuthzError } from "../lib/errors.js";
import type { IAuctionRepository } from "./interfaces/repositories.js";
import type { IPaymentWriteRepository } from "./interfaces/payment-write.js";

export class PaymentService {
  constructor(
    private readonly auctions: IAuctionRepository,
    private readonly payments: IPaymentWriteRepository,
  ) {}

  /**
   * Record a pending settlement for a won lot (Stripe client secret optional until configured).
   */
  async createPendingForWinner(
    buyerId: string,
    auctionId: string,
  ): Promise<Result<{ paymentId: string; clientSecret: string | null }, AuthzError>> {
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

  private totalDue(auction: Auction): number {
    const hammer = Number.parseFloat(auction.currentPrice);
    const rate = Number.parseFloat(auction.buyerPremiumRate);
    const safeHammer = Number.isFinite(hammer) ? hammer : 0;
    const safeRate = Number.isFinite(rate) ? rate : 0;
    return safeHammer * (1 + safeRate);
  }
}
