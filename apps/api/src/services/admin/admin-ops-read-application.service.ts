import type { IAttentionFeedReader } from "@auction/persistence";
import type { ListSubmissionsFilter } from "@auction/persistence";
import type { AdminMetricsService, AdminTodayMetrics } from "../admin-metrics.service.js";
import type { IAdminOpsReadService } from "../interfaces/admin-routes.js";
import type { DateRange, IAnalyticsService } from "../interfaces/analytics.js";
import type { IItemSubmissionAdminApi } from "../interfaces/item-submission-service.js";

export class AdminOpsReadApplicationService implements IAdminOpsReadService {
  constructor(
    private readonly analytics: IAnalyticsService,
    private readonly adminMetrics: AdminMetricsService,
    private readonly attentionFeed: IAttentionFeedReader,
    private readonly itemSubmissions: IItemSubmissionAdminApi,
  ) {}

  getAnalyticsDashboard(range: DateRange) {
    return this.analytics.getDashboard(range);
  }

  getTodayMetrics(): Promise<AdminTodayMetrics> {
    return this.adminMetrics.getTodaySnapshot();
  }

  getBidsPerMinute(): Promise<number> {
    return this.adminMetrics.getBidsPerMinute();
  }

  listAttentionFeed() {
    return this.attentionFeed.list();
  }

  countPendingSubmissions(
    filter: Omit<ListSubmissionsFilter, "limit" | "offset">,
  ): Promise<number> {
    return this.itemSubmissions.countPendingForAdmin(filter);
  }

  countQualityGapsForAdminApi() {
    return this.itemSubmissions.countQualityGapsForAdminApi();
  }

  countSubmissionsBySellersForAdminApi(sellerIds: readonly string[]) {
    return this.itemSubmissions.countSubmissionsBySellersForAdminApi(sellerIds);
  }
}
