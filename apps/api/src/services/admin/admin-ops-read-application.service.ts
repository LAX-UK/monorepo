import type { IAttentionFeedReader } from "@auction/persistence/interfaces";
import type { ListSubmissionsFilter } from "@auction/persistence/interfaces";
import type { AdminMetricsService, AdminTodayMetrics } from "../admin-metrics.service.js";
import type { IAdminOpsReadService } from "../interfaces/admin-routes.js";
import type { IItemSubmissionAdminApi } from "../interfaces/item-submission-apis.js";

export class AdminOpsReadApplicationService implements IAdminOpsReadService {
  constructor(
    private readonly adminMetrics: AdminMetricsService,
    private readonly attentionFeed: IAttentionFeedReader,
    private readonly itemSubmissions: IItemSubmissionAdminApi,
  ) {}

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
