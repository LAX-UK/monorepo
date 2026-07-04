import type { IPressArchiveRepository } from "@auction/persistence";
import { PUBLIC_SALE_STATUSES, viewerCanSeeNonPublicCatalog } from "@auction/validators";
import type {
  IPressArchiveReadService,
  PressArchiveListResult,
} from "./interfaces/press-archive-read.service.js";

const DEFAULT_ARCHIVE_STATUSES = ["ended"] as const;

export class PressArchiveReadService implements IPressArchiveReadService {
  constructor(private readonly pressArchiveRepo: IPressArchiveRepository) {}

  private resolveStatuses(viewer?: {
    role?: string | undefined;
    staffRole?: string | null | undefined;
  }) {
    if (viewerCanSeeNonPublicCatalog(viewer?.role, viewer?.staffRole)) {
      return [...PUBLIC_SALE_STATUSES, "draft"] as import("@auction/types").SaleStatus[];
    }
    return [...DEFAULT_ARCHIVE_STATUSES];
  }

  async listCoverage(
    filter: {
      limit: number;
      offset: number;
      year?: number;
      q?: string;
      mentionType?: import("@auction/types").SalePressMentionType;
    },
    viewer?: { role?: string | undefined; staffRole?: string | null | undefined },
  ): Promise<PressArchiveListResult> {
    const statuses = this.resolveStatuses(viewer);
    const base = {
      statuses,
      limit: filter.limit,
      offset: filter.offset,
      ...(filter.year !== undefined ? { year: filter.year } : {}),
      ...(filter.q !== undefined ? { q: filter.q } : {}),
      ...(filter.mentionType !== undefined ? { mentionType: filter.mentionType } : {}),
    };
    const page = await this.pressArchiveRepo.listCoveragePage(base);
    return {
      data: page.data,
      meta: {
        total: page.total,
        archiveTotal: page.archiveTotal,
        outletCount: page.outletCount,
        lastUpdated: page.lastUpdated,
        availableYears: page.availableYears,
      },
    };
  }

  async listDayMediaSales(
    limit: number,
    viewer?: { role?: string | undefined; staffRole?: string | null | undefined },
  ): Promise<import("@auction/types").PressDayMediaSaleSummary[]> {
    return this.pressArchiveRepo.listDayMediaSales({
      statuses: this.resolveStatuses(viewer),
      limit,
    });
  }

  async getSitemapFreshness(viewer?: {
    role?: string | undefined;
    staffRole?: string | null | undefined;
  }): Promise<import("@auction/types").PressSitemapSaleFreshness[]> {
    return this.pressArchiveRepo.listSitemapFreshness({
      statuses: this.resolveStatuses(viewer),
    });
  }
}
