import type {
  AdminConditionReportListSummary,
  ConditionReportRequestListRow,
  IConditionReportRequestRepository,
} from "@auction/persistence/interfaces";

export type AdminConditionReportListPage = {
  rows: ConditionReportRequestListRow[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminConditionReportListSummary;
};

export type AdminConditionReportListQueryFilter = {
  status?: "open" | "pending" | "in_progress" | "fulfilled" | "declined";
  lotId?: string;
  limit: number;
  offset: number;
};

/** Paginated admin condition report request queue read model (no mutation logic). */
export class AdminConditionReportListQueryService {
  constructor(private readonly requests: IConditionReportRequestRepository) {}

  async getPage(
    filter: AdminConditionReportListQueryFilter,
  ): Promise<AdminConditionReportListPage> {
    const baseFilter = {
      ...(filter.lotId ? { lotId: filter.lotId } : {}),
    };
    const listFilter = {
      ...baseFilter,
      ...(filter.status !== undefined ? { status: filter.status } : {}),
    };
    const [rowsResult, total, summary] = await Promise.all([
      this.requests.listForAdmin({
        ...listFilter,
        limit: filter.limit,
        offset: filter.offset,
      }),
      this.requests.countMatching(listFilter),
      this.requests.summarizeForAdmin(baseFilter),
    ]);
    return {
      rows: rowsResult.items,
      total,
      offset: filter.offset,
      limit: filter.limit,
      summary,
    };
  }
}
