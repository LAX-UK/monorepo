import type { Database } from "@auction/db";
import type {
  CreateNotificationRow,
  IBidRepository,
  ISaleRepository,
  NotificationPayload,
} from "@auction/persistence/interfaces";
import type { Bid, Lot } from "@auction/types";
import { computeLotCheckoutPricing } from "@auction/validators";
import type { INotificationFactory, INotificationOutboxService } from "../ports.js";

/** Row-level payload mapper (mirrors apps/api's notification-payload.ts helper). */
function notificationRowToPayload(row: CreateNotificationRow): NotificationPayload {
  return {
    type: row.type,
    title: row.title,
    message: row.message,
    lotId: row.lotId,
    submissionId: row.submissionId,
    legalEntityId: row.legalEntityId,
    ...(row.meta != null ? { meta: row.meta } : {}),
  };
}

export class BidCriticalNotificationStager {
  constructor(
    private readonly notificationOutbox: INotificationOutboxService | null,
    private readonly notificationFactory: INotificationFactory,
    private readonly saleRepo: ISaleRepository | null,
  ) {}

  async stageInTransaction(params: {
    lotId: string;
    lotRow: Lot;
    created: Bid;
    prevWinnerId: string | null;
    /** The account the outbid bid was placed for. */
    prevWinnerLegalEntityId: string | null;
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
            this.notificationFactory.createOutbid(
              lotForNotify,
              params.prevWinnerId,
              params.prevWinnerLegalEntityId,
              {
                currentBid: params.created.amount,
              },
            ),
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

      if (lotForNotify.sellerId) {
        await this.notificationOutbox.stageDispatch(
          {
            userId: lotForNotify.sellerId,
            payload: notificationRowToPayload(
              this.notificationFactory.createEndedSeller(lotForNotify, lotForNotify.sellerId, {
                hammerPrice: pricing.hammerMajor,
              }),
            ),
            idempotencyKey: `lot_ended_seller:${params.lotId}:${lotForNotify.sellerId}`,
          },
          params.tx,
        );
      }

      const bidders = await params.bids.listDistinctBidderAccounts(params.lotId);
      for (const { userId: uid, legalEntityId } of bidders) {
        if (uid === createdUserId) continue;
        await this.notificationOutbox.stageDispatch(
          {
            userId: uid,
            payload: notificationRowToPayload(
              this.notificationFactory.createLost(lotForNotify, uid, legalEntityId),
            ),
            idempotencyKey: `lot_lost:${params.lotId}:${uid}`,
          },
          params.tx,
        );
      }
    }
  }
}
