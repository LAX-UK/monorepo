import type {
  PressArchiveEntry,
  PressDayMediaSaleSummary,
  PressHubMeta,
  PressSitemapSaleFreshness,
  StaffRoles,
} from "@auction/types";

export type PressArchiveListResult = {
  data: PressArchiveEntry[];
  meta: PressHubMeta;
};

export interface IPressArchiveReadService {
  listCoverage(
    filter: {
      limit: number;
      offset: number;
      year?: number;
      q?: string;
      mentionType?: import("@auction/types").SalePressMentionType;
    },
    viewer?: { role?: string | undefined; staffRoles?: StaffRoles | undefined },
  ): Promise<PressArchiveListResult>;
  listDayMediaSales(
    limit: number,
    viewer?: { role?: string | undefined; staffRoles?: StaffRoles | undefined },
  ): Promise<PressDayMediaSaleSummary[]>;
  getSitemapFreshness(viewer?: {
    role?: string | undefined;
    staffRoles?: StaffRoles | undefined;
  }): Promise<PressSitemapSaleFreshness[]>;
}
