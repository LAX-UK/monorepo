import type { Bid, Lot } from "@auction/types";
import { moneyGte } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../lib/errors.js";
import type { ILotStrategyFactory } from "./interfaces/auction-strategy.js";
import type { ICacheProvider } from "./interfaces/cache.js";
import type { IBidRepository } from "./interfaces/repositories.js";
import type { IRepositoryFactory } from "./interfaces/repository-factory.js";
import { notificationRowToPayload } from "./notification-payload.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import { NotificationFactory } from "./notification.factory.js";
import type { NotificationService } from "./notification.service.js";

const ANTI_SNIPING_EXTENSION_MS = 30_000;
const MAX_PROXY_ROUNDS = 100;

function minIncrementAmount(lot: Lot): number {
  const n = Number.parseFloat(lot.minBidIncrement);
  return Number.isFinite(n) && n > 0 ? n : 0.01;
}

export type LotJobSchedulerPort = {
  rescheduleEnd(lotId: string, endTime: Date): Promise<void>;
  cancelLotJobs(lotId: string): Promise<void>;
};

export class BidService {
  constructor(
    private readonly repos: IRepositoryFactory,
    private readonly strategyFactory: ILotStrategyFactory,
    private readonly cache: ICacheProvider,
    private readonly notifications: NotificationService,
    private readonly notificationDispatcher: NotificationDispatcher | null,
    private readonly lotJobs: LotJobSchedulerPort | null,
  ) {}

  async placeBid(
    bidderId: string,
    lotId: string,
    amount: number,
    maxAutoBidAmount?: number,
  ): Promise<Result<Bid, BidError>> {
    try {
      let prevWinnerId: string | null = null;
      const { created, lot, nextEnd, endedEarly } = await this.repos.runInTransaction(
        async ({ lot: lots, bid: bids }) => {
          const lotRow = await lots.findByIdForUpdate(lotId);
          if (!lotRow) {
            throw new BidError("Lot not found", 404);
          }
          if (lotRow.status !== "active") {
            throw new BidError("Lot is not accepting bids", 400);
          }
          if (Date.now() > lotRow.endTime.getTime()) {
            throw new BidError("Lot has ended", 400);
          }

          const prevWinning = await bids.findWinningBid(lotId);
          prevWinnerId = prevWinning?.bidderId ?? null;

          const strategy = this.strategyFactory.create(lotRow.auctionType);
          const validation = strategy.validateBid(lotRow, { bidderId, amount });
          if (validation.isErr()) {
            throw validation.error;
          }

          const nextPrice = strategy.getNextPrice(lotRow, amount);
          const amountStr = nextPrice.toFixed(2);

          const hasMax =
            maxAutoBidAmount !== undefined &&
            Number.isFinite(maxAutoBidAmount) &&
            maxAutoBidAmount >= amount;
          const maxStr = hasMax ? maxAutoBidAmount.toFixed(2) : null;

          let lastBid = await bids.create({
            lotId,
            bidderId,
            amount: amountStr,
            isWinning: true,
            isAutoBid: hasMax,
            maxAutoBidAmount: maxStr,
          });

          if (lotRow.auctionType === "english" || lotRow.auctionType === "buy_it_now") {
            lastBid = await this.runProxyAutoBids(bids, lotId, lastBid, minIncrementAmount(lotRow));
          }

          await bids.markWinningBid(lotId, lastBid.id);
          if (lotRow.auctionType === "sealed") {
            await lots.updateCurrentPrice(lotId, lotRow.startingPrice);
          } else {
            await lots.updateCurrentPrice(lotId, lastBid.amount);
          }

          let nextEnd = lotRow.endTime;
          if (
            strategy.shouldExtendTime(lotRow, {
              bidderId,
              amount: Number.parseFloat(amountStr),
            })
          ) {
            nextEnd = new Date(lotRow.endTime.getTime() + ANTI_SNIPING_EXTENSION_MS);
            await lots.updateEndTime(lotId, nextEnd);
          }

          let endedEarly = false;
          if (lotRow.auctionType === "dutch") {
            await lots.setWinner(lotId, lastBid.bidderId);
            await lots.updateStatus(lotId, "ended");
            endedEarly = true;
          } else if (lotRow.auctionType === "buy_it_now") {
            const bn =
              lotRow.buyNowPrice !== null && lotRow.buyNowPrice !== ""
                ? Number(lotRow.buyNowPrice)
                : null;
            if (
              bn !== null &&
              Number.isFinite(bn) &&
              lotRow.buyNowPrice !== null &&
              lotRow.buyNowPrice !== "" &&
              moneyGte(lastBid.amount, lotRow.buyNowPrice)
            ) {
              await lots.setWinner(lotId, lastBid.bidderId);
              await lots.updateStatus(lotId, "ended");
              endedEarly = true;
            }
          }

          return { created: lastBid, lot: lotRow, nextEnd, endedEarly };
        },
      );

      const displayPrice =
        lot.auctionType === "sealed" && !endedEarly ? lot.startingPrice : created.amount;

      const updatedLot = endedEarly
        ? {
            ...lot,
            endTime: nextEnd,
            currentPrice: created.amount,
            status: "ended" as const,
            winnerId: created.bidderId,
          }
        : nextEnd.getTime() !== lot.endTime.getTime()
          ? { ...lot, endTime: nextEnd, currentPrice: displayPrice }
          : { ...lot, currentPrice: displayPrice };

      await this.cache.set(`lot:${lotId}:currentPrice`, displayPrice, 3600);

      const outbidMeta =
        prevWinnerId && prevWinnerId !== created.bidderId
          ? { outbidUserId: prevWinnerId }
          : undefined;
      await this.notifications.notifyBidPlaced(updatedLot, created, outbidMeta);

      if (endedEarly) {
        await this.lotJobs?.cancelLotJobs(lotId);
        await this.notifications.notifyLotEnded(updatedLot, created);
      }

      if (nextEnd.getTime() !== lot.endTime.getTime() && !endedEarly) {
        await this.notifications.notifyLotExtended(updatedLot, nextEnd);
        await this.lotJobs?.rescheduleEnd(lotId, nextEnd);
      }

      if (this.notificationDispatcher && prevWinnerId && prevWinnerId !== created.bidderId) {
        const factory = new NotificationFactory();
        await this.notificationDispatcher.dispatch(
          prevWinnerId,
          notificationRowToPayload(factory.createOutbid(lot, prevWinnerId)),
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
    lotId: string,
    initialBid: Bid,
    minInc: number,
  ): Promise<Bid> {
    let lastBid = initialBid;
    let currentPrice = Number(lastBid.amount);
    let winnerId = lastBid.bidderId;

    for (let round = 0; round < MAX_PROXY_ROUNDS; round++) {
      const ceilings = await bids.aggregateBidderCeilings(lotId);
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
        lotId,
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
  async listForLot(lotId: string, limit: number): Promise<Bid[]> {
    return this.repos.root.bid.listForLot(lotId, limit);
  }
}
