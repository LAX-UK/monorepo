import type { Auction, Bid } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../lib/errors.js";
import type { IAuctionStrategyFactory } from "./interfaces/auction-strategy.js";
import type { ICacheProvider } from "./interfaces/cache.js";
import type { IBidRepository } from "./interfaces/repositories.js";
import type { IRepositoryFactory } from "./interfaces/repository-factory.js";
import { notificationRowToPayload } from "./notification-payload.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import { NotificationFactory } from "./notification.factory.js";
import type { NotificationService } from "./notification.service.js";

const ANTI_SNIPING_EXTENSION_MS = 30_000;
const MAX_PROXY_ROUNDS = 100;

function minIncrementAmount(auction: Auction): number {
  const n = Number.parseFloat(auction.minBidIncrement);
  return Number.isFinite(n) && n > 0 ? n : 0.01;
}

function bidderCeilings(bids: Bid[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const b of bids) {
    const amt = Number(b.amount);
    const cap =
      b.maxAutoBidAmount !== null && b.maxAutoBidAmount !== ""
        ? Math.max(amt, Number(b.maxAutoBidAmount))
        : amt;
    m.set(b.bidderId, Math.max(m.get(b.bidderId) ?? 0, cap));
  }
  return m;
}

export type AuctionJobSchedulerPort = {
  rescheduleEnd(auctionId: string, endTime: Date): Promise<void>;
  cancelAuctionJobs(auctionId: string): Promise<void>;
};

export class BidService {
  constructor(
    private readonly repos: IRepositoryFactory,
    private readonly strategyFactory: IAuctionStrategyFactory,
    private readonly cache: ICacheProvider,
    private readonly notifications: NotificationService,
    private readonly notificationDispatcher: NotificationDispatcher | null,
    private readonly auctionJobs: AuctionJobSchedulerPort | null,
  ) {}

  async placeBid(
    bidderId: string,
    auctionId: string,
    amount: number,
    maxAutoBidAmount?: number,
  ): Promise<Result<Bid, BidError>> {
    try {
      let prevWinnerId: string | null = null;
      const { created, auction, nextEnd, endedEarly } = await this.repos.runInTransaction(
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

          const prevWinning = await bids.findWinningBid(auctionId);
          prevWinnerId = prevWinning?.bidderId ?? null;

          const strategy = this.strategyFactory.create(auctionRow.auctionType);
          const validation = strategy.validateBid(auctionRow, { bidderId, amount });
          if (validation.isErr()) {
            throw validation.error;
          }

          const nextPrice = strategy.getNextPrice(auctionRow, amount);
          const amountStr = nextPrice.toFixed(2);

          const hasMax =
            maxAutoBidAmount !== undefined &&
            Number.isFinite(maxAutoBidAmount) &&
            maxAutoBidAmount >= amount;
          const maxStr = hasMax ? maxAutoBidAmount.toFixed(2) : null;

          let lastBid = await bids.create({
            auctionId,
            bidderId,
            amount: amountStr,
            isWinning: true,
            isAutoBid: hasMax,
            maxAutoBidAmount: maxStr,
          });

          if (auctionRow.auctionType === "english" || auctionRow.auctionType === "buy_it_now") {
            lastBid = await this.runProxyAutoBids(
              bids,
              auctionId,
              lastBid,
              minIncrementAmount(auctionRow),
            );
          }

          await bids.markWinningBid(auctionId, lastBid.id);
          await auctions.updateCurrentPrice(auctionId, lastBid.amount);

          let nextEnd = auctionRow.endTime;
          if (
            strategy.shouldExtendTime(auctionRow, {
              bidderId,
              amount: Number.parseFloat(amountStr),
            })
          ) {
            nextEnd = new Date(auctionRow.endTime.getTime() + ANTI_SNIPING_EXTENSION_MS);
            await auctions.updateEndTime(auctionId, nextEnd);
          }

          let endedEarly = false;
          if (auctionRow.auctionType === "dutch") {
            await auctions.setWinner(auctionId, lastBid.bidderId);
            await auctions.updateStatus(auctionId, "ended");
            endedEarly = true;
          } else if (auctionRow.auctionType === "buy_it_now") {
            const bn =
              auctionRow.buyNowPrice !== null && auctionRow.buyNowPrice !== ""
                ? Number(auctionRow.buyNowPrice)
                : null;
            if (bn !== null && Number.isFinite(bn) && Number(lastBid.amount) + 1e-9 >= bn) {
              await auctions.setWinner(auctionId, lastBid.bidderId);
              await auctions.updateStatus(auctionId, "ended");
              endedEarly = true;
            }
          }

          return { created: lastBid, auction: auctionRow, nextEnd, endedEarly };
        },
      );

      const updatedAuction = endedEarly
        ? {
            ...auction,
            endTime: nextEnd,
            currentPrice: created.amount,
            status: "ended" as const,
            winnerId: created.bidderId,
          }
        : nextEnd.getTime() !== auction.endTime.getTime()
          ? { ...auction, endTime: nextEnd, currentPrice: created.amount }
          : { ...auction, currentPrice: created.amount };

      await this.cache.set(`auction:${auctionId}:currentPrice`, created.amount, 3600);

      const outbidMeta =
        prevWinnerId && prevWinnerId !== created.bidderId
          ? { outbidUserId: prevWinnerId }
          : undefined;
      await this.notifications.notifyBidPlaced(updatedAuction, created, outbidMeta);

      if (endedEarly) {
        await this.auctionJobs?.cancelAuctionJobs(auctionId);
        await this.notifications.notifyAuctionEnded(updatedAuction, created);
      }

      if (nextEnd.getTime() !== auction.endTime.getTime() && !endedEarly) {
        await this.notifications.notifyAuctionExtended(updatedAuction, nextEnd);
        await this.auctionJobs?.rescheduleEnd(auctionId, nextEnd);
      }

      if (this.notificationDispatcher && prevWinnerId && prevWinnerId !== created.bidderId) {
        const factory = new NotificationFactory();
        await this.notificationDispatcher.dispatch(
          prevWinnerId,
          notificationRowToPayload(factory.createOutbid(auction, prevWinnerId)),
        );
      }

      return ok(created);
    } catch (e) {
      if (e instanceof BidError) {
        return err(e);
      }
      throw e;
    }
  }

  private async runProxyAutoBids(
    bids: IBidRepository,
    auctionId: string,
    initialBid: Bid,
    minInc: number,
  ): Promise<Bid> {
    let lastBid = initialBid;
    let currentPrice = Number(lastBid.amount);
    let winnerId = lastBid.bidderId;

    for (let round = 0; round < MAX_PROXY_ROUNDS; round++) {
      const all = await bids.listForAuction(auctionId, 5000);
      const ceilings = bidderCeilings(all);
      type Cand = { bidderId: string; ceiling: number };
      const candidates: Cand[] = [];
      for (const [bidderId, ceiling] of ceilings) {
        if (bidderId === winnerId) continue;
        if (ceiling >= currentPrice + minInc - 1e-9) {
          candidates.push({ bidderId, ceiling });
        }
      }
      if (candidates.length === 0) break;
      candidates.sort((a, b) => {
        if (b.ceiling !== a.ceiling) return b.ceiling - a.ceiling;
        return a.bidderId.localeCompare(b.bidderId);
      });
      const challenger = candidates[0];
      if (!challenger) break;
      const nextAmt = Math.min(challenger.ceiling, currentPrice + minInc);
      if (nextAmt <= currentPrice + 1e-9) break;

      const nextStr = nextAmt.toFixed(2);
      lastBid = await bids.create({
        auctionId,
        bidderId: challenger.bidderId,
        amount: nextStr,
        isWinning: true,
        isAutoBid: true,
        maxAutoBidAmount: challenger.ceiling.toFixed(2),
      });
      currentPrice = nextAmt;
      winnerId = challenger.bidderId;
    }

    return lastBid;
  }

  /** Public bid history for a lot (newest first). */
  async listForAuction(auctionId: string, limit: number): Promise<Bid[]> {
    return this.repos.root.bid.listForAuction(auctionId, limit);
  }
}
