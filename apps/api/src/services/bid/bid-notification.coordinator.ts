import type { Bid, Lot } from "@auction/types";
import type { AdminMetricsService } from "../admin-metrics.service.js";
import type { ICacheProvider } from "../interfaces/cache.js";
import { notificationRowToPayload } from "../notification-payload.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";
import { NotificationFactory } from "../notification.factory.js";
import type { NotificationService } from "../notification.service.js";
import type { LotJobSchedulerPort } from "./bid-policy.js";

export class BidNotificationCoordinator {
  constructor(
    private readonly cache: ICacheProvider,
    private readonly notifications: NotificationService,
    private readonly notificationDispatcher: NotificationDispatcher | null,
    private readonly lotJobs: LotJobSchedulerPort | null,
    private readonly adminMetrics: AdminMetricsService | null,
  ) {}

  async afterBidCommitted(params: {
    lotId: string;
    displayPrice: string;
    updatedLot: Lot;
    created: Bid;
    prevWinnerId: string | null;
    nextEnd: Date;
    lotEndBefore: Date;
    endedEarly: boolean;
  }): Promise<void> {
    const {
      lotId,
      displayPrice,
      updatedLot,
      created,
      prevWinnerId,
      nextEnd,
      lotEndBefore,
      endedEarly,
    } = params;

    await this.runBestEffort("cache.set", () =>
      this.cache.set(`lot:${lotId}:currentPrice`, displayPrice, 3600),
    );

    void this.adminMetrics?.recordBidPlaced();

    const outbidMeta =
      prevWinnerId && prevWinnerId !== created.placedByUserId
        ? { outbidUserId: prevWinnerId }
        : undefined;

    await this.runBestEffort("notifyBidPlaced", () =>
      this.notifications.notifyBidPlaced(updatedLot, created, outbidMeta),
    );

    if (endedEarly) {
      await this.runBestEffort("cancelLotJobs", async () => {
        await this.lotJobs?.cancelLotJobs(lotId);
      });
      await this.runBestEffort("notifyLotEnded", () =>
        this.notifications.notifyLotEnded(updatedLot, created),
      );
    }

    if (nextEnd.getTime() !== lotEndBefore.getTime() && !endedEarly) {
      await this.runBestEffort("notifyLotExtended", () =>
        this.notifications.notifyLotExtended(updatedLot, nextEnd),
      );
      await this.runBestEffort("rescheduleEnd", async () => {
        await this.lotJobs?.rescheduleEnd(lotId, nextEnd);
      });
    }

    if (this.notificationDispatcher && prevWinnerId && prevWinnerId !== created.placedByUserId) {
      const dispatcher = this.notificationDispatcher;
      await this.runBestEffort("dispatchOutbid", async () => {
        const factory = new NotificationFactory();
        await dispatcher.dispatch(
          prevWinnerId,
          notificationRowToPayload(factory.createOutbid(updatedLot, prevWinnerId)),
        );
      });
    }
  }

  private async runBestEffort(label: string, fn: () => void | Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      console.error(`[BidNotificationCoordinator] ${label} failed`, err);
    }
  }
}
