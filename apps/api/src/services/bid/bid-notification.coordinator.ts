import type { Bid, Lot } from "@auction/types";
import type { AdminMetricsService } from "../admin-metrics.service.js";
import type { ICacheProvider } from "../interfaces/cache.js";
import type { NotificationService } from "../notification.service.js";
import type { LotJobSchedulerPort } from "./bid-policy.js";

export class BidNotificationCoordinator {
  constructor(
    private readonly cache: ICacheProvider,
    private readonly notifications: NotificationService,
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
    bidCount?: number;
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
      bidCount,
    } = params;

    await this.runBestEffort("cache.set", () =>
      this.cache.set(`lot:${lotId}:currentPrice`, displayPrice, 3600),
    );

    void this.adminMetrics?.recordBidPlaced();

    const outbidMeta =
      prevWinnerId && prevWinnerId !== created.placedByUserId
        ? { outbidUserId: prevWinnerId, ...(bidCount != null ? { bidCount } : {}) }
        : bidCount != null
          ? { bidCount }
          : undefined;

    await this.runBestEffort("notifyBidPlaced", () =>
      this.notifications.notifyBidPlaced(updatedLot, created, outbidMeta),
    );

    if (endedEarly) {
      await this.runBestEffort("cancelLotJobs", async () => {
        await this.lotJobs?.cancelLotJobs(lotId);
      });
      await this.runBestEffort("notifyLotEnded", () =>
        this.notifications.notifyLotEnded(updatedLot, created, {
          trigger: "early_close",
          hadBids: true,
        }),
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
  }

  private async runBestEffort(label: string, fn: () => void | Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      console.error(`[BidNotificationCoordinator] ${label} failed`, err);
    }
  }
}
