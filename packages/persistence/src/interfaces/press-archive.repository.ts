import type {
  PressArchiveEntry,
  PressDayMediaSaleSummary,
  PressSitemapSaleFreshness,
  SaleStatus,
} from "@auction/types";

export type ListPressArchiveFilter = {
  statuses: SaleStatus[];
  limit: number;
  offset: number;
  year?: number;
  q?: string;
  mentionType?: import("@auction/types").SalePressMentionType;
};

export type PressCoveragePageResult = {
  data: PressArchiveEntry[];
  total: number;
  archiveTotal: number;
  outletCount: number;
  lastUpdated: Date | null;
  availableYears: number[];
};

export interface IPressArchiveRepository {
  listCoveragePage(filter: ListPressArchiveFilter): Promise<PressCoveragePageResult>;
  listDayMediaSales(params: { statuses: SaleStatus[]; limit: number }): Promise<
    PressDayMediaSaleSummary[]
  >;
  listSitemapFreshness(params: { statuses: SaleStatus[] }): Promise<PressSitemapSaleFreshness[]>;
}
