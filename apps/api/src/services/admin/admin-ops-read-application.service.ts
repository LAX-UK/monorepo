import type { AdminMetricsService, AdminTodayMetrics } from "../admin-metrics.service.js";
import type { ConveyorPipelineRowDto, IAdminOpsReadService } from "../interfaces/admin-routes.js";
import type { DateRange, IAnalyticsService } from "../interfaces/analytics.js";
import type { IAttentionFeedReader } from "../interfaces/attention-feed.js";
import type { IConveyorPipelineReader } from "../interfaces/conveyor-pipeline-reader.js";
import type { IItemSubmissionService } from "../interfaces/item-submission-service.js";
import type { ListSubmissionsFilter } from "../interfaces/repositories.js";

export class AdminOpsReadApplicationService implements IAdminOpsReadService {
  constructor(
    private readonly analytics: IAnalyticsService,
    private readonly adminMetrics: AdminMetricsService,
    private readonly attentionFeed: IAttentionFeedReader,
    private readonly itemSubmissions: IItemSubmissionService,
    private readonly conveyorReader: IConveyorPipelineReader,
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

  async listConveyorPipeline(limit = 200): Promise<ConveyorPipelineRowDto[]> {
    const rows = await this.conveyorReader.listRecent(limit);
    return rows.map(
      (r): ConveyorPipelineRowDto => ({
        submissionId: r.submissionId,
        title: r.title,
        submissionStatus: r.submissionStatus,
        convertedLotId: r.convertedLotId,
        lotId: r.lotId,
        lotStatus: r.lotStatus,
        lotTitle: r.lotTitle,
        artistReviewRequired: r.artistReviewRequired,
        archivedSeller: r.archivedSeller,
        assignedToUserId: r.assignedToUserId,
        updatedAt: r.updatedAt.toISOString(),
      }),
    );
  }

  countQualityGapsForAdminApi() {
    return this.itemSubmissions.countQualityGapsForAdminApi();
  }

  countSubmissionsBySellersForAdminApi(sellerIds: readonly string[]) {
    return this.itemSubmissions.countSubmissionsBySellersForAdminApi(sellerIds);
  }
}
