import type {
  PressArchiveEntry,
  PressDayMediaSaleSummary,
  PressHubMeta,
  PressSitemapSaleFreshness,
} from "@auction/types";

export type PressArchiveListResult = {
  data: PressArchiveEntry[];
  meta: PressHubMeta;
};

export interface IPressArchiveReadService {
  listCoverage(
    filter: { limit: number; offset: number; year?: number; q?: string },
    viewer?: { role?: string | undefined; staffRole?: string | null | undefined },
  ): Promise<PressArchiveListResult>;
  listDayMediaSales(
    limit: number,
    viewer?: { role?: string | undefined; staffRole?: string | null | undefined },
  ): Promise<PressDayMediaSaleSummary[]>;
  getSitemapFreshness(viewer?: {
    role?: string | undefined;
    staffRole?: string | null | undefined;
  }): Promise<PressSitemapSaleFreshness[]>;
}
