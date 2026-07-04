import type { Database } from "@auction/db";
import type { IBidRepository } from "@auction/persistence";
import type { ISaleRepository } from "@auction/persistence";
import type { Bid, Lot } from "@auction/types";
import { computeLotCheckoutPricing } from "../../lib/lot-checkout-pricing.js";
import type { INotificationOutboxService } from "../interfaces/notification-outbox.js";
import { notificationRowToPayload } from "../notification-payload.js";
import type { NotificationFactory } from "../notification.factory.js";

export class BidCriticalNotificationStager {
  constructor(
    private readonly notificationOutbox: INotificationOutboxService | null,
    private readonly notificationFactory: NotificationFactory,
    private readonly saleRepo: ISaleRepository | null,
  ) {}

  async stageInTransaction(params: {
    lotId: string;
    lotRow: Lot;
    created: Bid;
    prevWinnerId: string | null;
    endedEarly: boolean;
    bids: IBidRepository;
    tx: Database;
  }): Promise<void> {
    if (!this.notificationOutbox) return;

    const createdUserId = params.created.placedByUserId ?? params.created.bidderId ?? null;
    if (!createdUserId) return;

    const lotForNotify: Lot = params.endedEarly
      ? {
          ...params.lotRow,
          status: "ended",
          endTime: params.lotRow.endTime,
          currentPrice: params.created.amount,
          winnerId: createdUserId,
          ...(params.created.buyerLegalEntityId
            ? { buyerLegalEntityId: params.created.buyerLegalEntityId }
            : {}),
        }
      : params.lotRow;

    if (params.prevWinnerId && params.prevWinnerId !== createdUserId) {
      await this.notificationOutbox.stageDispatch(
        {
          userId: params.prevWinnerId,
          payload: notificationRowToPayload(
            this.notificationFactory.createOutbid(lotForNotify, params.prevWinnerId),
          ),
          idempotencyKey: `outbid:${params.lotId}:${params.created.id}:${params.prevWinnerId}`,
        },
        params.tx,
      );
    }

    if (params.endedEarly) {
      const sale = lotForNotify.saleId ? await this.saleRepo?.findById(lotForNotify.saleId) : null;
      const pricing = computeLotCheckoutPricing(lotForNotify, sale ?? null);
      await this.notificationOutbox.stageDispatch(
        {
          userId: createdUserId,
          payload: notificationRowToPayload(
            this.notificationFactory.createWon(lotForNotify, createdUserId, {
              hammerPrice: pricing.hammerMajor,
              totalDue: pricing.totalMajor,
            }),
          ),
          idempotencyKey: `lot_won:${params.lotId}:${createdUserId}`,
        },
        params.tx,
      );

      const bidderIds = await params.bids.listDistinctBidderIds(params.lotId);
      for (const uid of bidderIds) {
        if (uid === createdUserId) continue;
        await this.notificationOutbox.stageDispatch(
          {
            userId: uid,
            payload: notificationRowToPayload(
              this.notificationFactory.createLost(lotForNotify, uid),
            ),
            idempotencyKey: `lot_lost:${params.lotId}:${uid}`,
          },
          params.tx,
        );
      }
    }
  }
}
