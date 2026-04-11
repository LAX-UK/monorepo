import type { Bid } from "@auction/types";
import { err, ok, type Result } from "neverthrow";
import { BidError } from "../lib/errors.js";
import type { ICacheProvider } from "./interfaces/cache.js";
import type { IAuctionStrategyFactory } from "./interfaces/auction-strategy.js";
import type { IRepositoryFactory } from "./interfaces/repository-factory.js";
import { NotificationService } from "./notification.service.js";

const ANTI_SNIPING_EXTENSION_MS = 30_000;

export class BidService {
  constructor(
    private readonly repos: IRepositoryFactory,
    private readonly strategyFactory: IAuctionStrategyFactory,
    private readonly cache: ICacheProvider,
    private readonly notifications: NotificationService,
  ) {}

  async placeBid(
    bidderId: string,
    auctionId: string,
    amount: number,
  ): Promise<Result<Bid, BidError>> {
    try {
      const { created, auction, nextEnd } = await this.repos.runInTransaction(
        async ({ auction: auctions, bid: bids }) => {
          const auctionRow = await auctions.findByIdForUpdate(auctionId);
          if (!auctionRow) {
            throw new BidError("Auction not found", 404);
          }
          if (auctionRow.status !== "active") {
            throw new BidError("Auction is not accepting bids", 400);
          }
          if (Date.now() > auctionRow.endTime.getTime()) {
            throw new BidError("Auction has ended", 400);
          }

          const strategy = this.strategyFactory.create(auctionRow.auctionType);
          const validation = strategy.validateBid(auctionRow, { bidderId, amount });
          if (validation.isErr()) {
            throw validation.error;
          }

          const nextPrice = strategy.getNextPrice(auctionRow, amount);
          const amountStr = nextPrice.toFixed(2);

          const createdBid = await bids.create({
            auctionId,
            bidderId,
            amount: amountStr,
            isWinning: true,
            isAutoBid: false,
            maxAutoBidAmount: null,
          });

          await bids.markWinningBid(auctionId, createdBid.id);
          await auctions.updateCurrentPrice(auctionId, amountStr);

          let nextEnd = auctionRow.endTime;
          if (strategy.shouldExtendTime(auctionRow, { bidderId, amount })) {
            nextEnd = new Date(auctionRow.endTime.getTime() + ANTI_SNIPING_EXTENSION_MS);
            await auctions.updateEndTime(auctionId, nextEnd);
          }

          return { created: createdBid, auction: auctionRow, nextEnd };
        },
      );

      const updatedAuction =
        nextEnd.getTime() !== auction.endTime.getTime()
          ? { ...auction, endTime: nextEnd, currentPrice: created.amount }
          : { ...auction, currentPrice: created.amount };

      await this.cache.set(`auction:${auctionId}:currentPrice`, created.amount, 3600);
      await this.notifications.notifyBidPlaced(updatedAuction, created);
      if (nextEnd.getTime() !== auction.endTime.getTime()) {
        await this.notifications.notifyAuctionExtended(updatedAuction, nextEnd);
      }

      return ok(created);
    } catch (e) {
      if (e instanceof BidError) {
        return err(e);
      }
      throw e;
    }
  }
}
