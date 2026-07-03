import type { Redis } from "ioredis";
import type { IItemSubmissionAdminApi } from "./interfaces/item-submission-service.js";
import type { IPaymentMaintenanceService } from "./interfaces/payment-service.js";
import type { IRepositoryFactory } from "./interfaces/repository-factory.js";

const BIDS_1M_KEY = "admin:metrics:bids:1m";

export type AdminTodayMetrics = {
  liveLots: number;
  endingWithinHour: number;
  draftLots: number;
  pendingSubmissions: number;
  stalePendingPayments: number;
  revenueToday: string;
};

/** SRP: admin cockpit counters + rolling 1m bid rate (Redis).
 */
export class AdminMetricsService {
  constructor(
    private readonly repos: IRepositoryFactory,
    private readonly redis: Redis,
    private readonly itemSubmissionService: IItemSubmissionAdminApi,
    private readonly paymentService: IPaymentMaintenanceService,
  ) {}

  async recordBidPlaced(): Promise<void> {
    try {
      const n = await this.redis.incr(BIDS_1M_KEY);
      if (n === 1) {
        await this.redis.expire(BIDS_1M_KEY, 60);
      }
    } catch {
      /* ignore redis errors */
    }
  }

  async getBidsPerMinute(): Promise<number> {
    try {
      const v = await this.redis.get(BIDS_1M_KEY);
      return Number.parseInt(v ?? "0", 10) || 0;
    } catch {
      return 0;
    }
  }

  async getTodaySnapshot(now: Date = new Date()): Promise<AdminTodayMetrics> {
    const lot = this.repos.root.lot;
    const hourEnd = new Date(now.getTime() + 60 * 60_000);

    const startOfUtcDay = (d: Date) => {
      const x = new Date(d);
      x.setUTCHours(0, 0, 0, 0);
      return x;
    };
    const todayStart = startOfUtcDay(now);

    const [
      liveLots,
      endingWithinHour,
      draftLots,
      pendingSubmissions,
      stalePendingPayments,
      revenueToday,
    ] = await Promise.all([
      lot.countMatching({ status: "active" }),
      lot.findActiveByEndTimeBetween(now, hourEnd).then((r) => r.length),
      lot.countMatching({ status: "draft" }),
      this.itemSubmissionService.countPendingForAdmin({ status: "under_review" }),
      this.paymentService.countPendingOlderThanHours(48),
      this.paymentService.sumCapturedBetween(todayStart, now),
    ]);

    return {
      liveLots,
      endingWithinHour,
      draftLots,
      pendingSubmissions,
      stalePendingPayments,
      revenueToday,
    };
  }
}
