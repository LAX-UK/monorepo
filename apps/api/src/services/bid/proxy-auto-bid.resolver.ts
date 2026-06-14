import type { Database } from "@auction/db";
import type { Bid, Lot } from "@auction/types";
import { parseMoneyToMinorUnits } from "@auction/validators";
import { Counter } from "prom-client";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { IAntiShillingGuard } from "../interfaces/anti-shilling.js";
import type { IBidRepository } from "../interfaces/repositories.js";
import type { NotificationService } from "../notification.service.js";
import { effectiveBidderStepMoney, moneyStringGtCurrent, settleProxyPrice } from "./bid-money.js";

const proxyCancelNotifyFailedTotal = new Counter({
  name: "proxy_cancel_notify_failed_total",
  help: "Failed proxy auto-bid cancellation notifications",
});

export type BidderCeilingState = {
  bidderId: string;
  buyerLegalEntityId: string;
  ceiling: string;
  autoBidStepAmount: string | null;
  maxCreatedAt: Date | null;
};

export type ProxyCancelNotification = {
  lotId: string;
  bidderUserId: string;
  reason: string;
};

export class ProxyAutoBidResolver {
  constructor(
    private readonly antiShillingGuard: IAntiShillingGuard | null,
    private readonly notifications: NotificationService,
    private readonly domainEventPublisher: DomainEventPublisher | null,
  ) {}

  async resolve(
    bids: IBidRepository,
    lotId: string,
    lot: Lot,
    initialBid: Bid,
    tx: Database,
    pendingProxyCancels: ProxyCancelNotification[],
  ): Promise<Bid> {
    const initialBidderId = initialBid.placedByUserId ?? initialBid.bidderId ?? null;
    if (!initialBidderId) return initialBid;

    let states = await bids.listBidderCeilingStates(lotId);
    states = await this.filterShillViolations(states, lotId, lot, bids, tx, pendingProxyCancels);
    if (states.length === 0) return initialBid;

    const sorted = [...states].sort((a, b) => {
      const aCeiling = parseMoneyToMinorUnits(a.ceiling);
      const bCeiling = parseMoneyToMinorUnits(b.ceiling);
      if (bCeiling !== aCeiling) {
        return bCeiling > aCeiling ? 1 : -1;
      }
      const aTime = a.maxCreatedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.maxCreatedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

    const winner = sorted[0];
    if (!winner) return initialBid;

    const runnerUp = sorted.find((s) => s.bidderId !== winner.bidderId) ?? null;
    const winnerStep = effectiveBidderStepMoney(lot, winner.autoBidStepAmount);
    const settlePrice = settleProxyPrice({
      winnerCeiling: winner.ceiling,
      runnerUpCeiling: runnerUp?.ceiling ?? null,
      winnerStep,
      currentPrice: initialBid.amount,
    });

    if (!settlePrice || !moneyStringGtCurrent(settlePrice, initialBid.amount)) {
      return initialBid;
    }

    if (winner.bidderId === initialBidderId && settlePrice === initialBid.amount) {
      return initialBid;
    }

    const proxyChannel = initialBid.placedVia ?? "web";

    return bids.create({
      lotId,
      placedByUserId: winner.bidderId,
      buyerLegalEntityId: winner.buyerLegalEntityId,
      amount: settlePrice,
      isWinning: false,
      isAutoBid: true,
      maxAutoBidAmount: winner.ceiling,
      autoBidStepAmount: winnerStep,
      placedVia: proxyChannel,
      telephoneBookingId: null,
    });
  }

  async cancelViolatingProxyBids(
    lotId: string,
    lotRow: Lot,
    bids: IBidRepository,
    tx: Database,
    pendingProxyCancels: ProxyCancelNotification[],
  ): Promise<void> {
    if (!this.antiShillingGuard) return;
    const states = await bids.listBidderCeilingStates(lotId);
    for (const s of states) {
      if (!(await bids.bidderHasProxyMaxOnLot(lotId, s.bidderId))) continue;
      if (
        await this.antiShillingGuard.violatesAntiShilling({
          bidderUserId: s.bidderId,
          buyerLegalEntityId: s.buyerLegalEntityId,
          lot: lotRow,
        })
      ) {
        await bids.clearProxyAutoBidForBidderOnLot(lotId, s.bidderId);
        this.queueProxyCancelled(lotId, s.bidderId, "anti_shilling_violation", pendingProxyCancels);
        if (this.domainEventPublisher) {
          await this.domainEventPublisher.publish(tx, {
            aggregateType: "lot",
            aggregateId: lotId,
            eventType: "bid.proxy_cancelled",
            payload: {
              lotId,
              bidderUserId: s.bidderId,
              buyerLegalEntityId: s.buyerLegalEntityId,
              reason: "anti_shilling_violation",
            },
            actorUserId: null,
          });
        }
      }
    }
  }

  async flushPendingProxyCancels(pending: ProxyCancelNotification[]): Promise<void> {
    for (const item of pending) {
      await this.notifyProxyCancelledSafe(item.lotId, item.bidderUserId, item.reason);
    }
  }

  private queueProxyCancelled(
    lotId: string,
    bidderUserId: string,
    reason: string,
    pending: ProxyCancelNotification[],
  ): void {
    pending.push({ lotId, bidderUserId, reason });
  }

  private async filterShillViolations(
    states: BidderCeilingState[],
    lotId: string,
    lot: Lot,
    bids: IBidRepository,
    tx: Database,
    pendingProxyCancels: ProxyCancelNotification[],
  ): Promise<BidderCeilingState[]> {
    if (!this.antiShillingGuard) return states;
    const kept: BidderCeilingState[] = [];
    for (const s of states) {
      const shill = await this.antiShillingGuard.violatesAntiShilling({
        bidderUserId: s.bidderId,
        buyerLegalEntityId: s.buyerLegalEntityId,
        lot,
      });
      if (shill) {
        if (await bids.bidderHasProxyMaxOnLot(lotId, s.bidderId)) {
          await bids.clearProxyAutoBidForBidderOnLot(lotId, s.bidderId);
          this.queueProxyCancelled(
            lotId,
            s.bidderId,
            "anti_shilling_violation",
            pendingProxyCancels,
          );
          if (this.domainEventPublisher) {
            await this.domainEventPublisher.publish(tx, {
              aggregateType: "lot",
              aggregateId: lotId,
              eventType: "bid.proxy_cancelled",
              payload: {
                lotId,
                bidderUserId: s.bidderId,
                buyerLegalEntityId: s.buyerLegalEntityId,
                reason: "anti_shilling_violation",
              },
              actorUserId: null,
            });
          }
        }
        continue;
      }
      kept.push(s);
    }
    return kept;
  }

  private async notifyProxyCancelledSafe(
    lotId: string,
    bidderUserId: string,
    reason: string,
  ): Promise<void> {
    try {
      await this.notifications.notifyProxyCancelled(lotId, bidderUserId, reason);
    } catch (err) {
      proxyCancelNotifyFailedTotal.inc();
      console.error("[ProxyAutoBidResolver] notifyProxyCancelled failed", {
        lotId,
        bidderUserId,
        reason,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
