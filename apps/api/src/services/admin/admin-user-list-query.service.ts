import type {
  AdminUserListFilter,
  AdminUserListRow,
  AdminUserListSummary,
  IAdminUserBrowseReader,
} from "@auction/persistence/interfaces";

export type AdminUserListPage = {
  rows: AdminUserListRow[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminUserListSummary;
};

/** Paginated admin users directory read model (no mutation logic). */
export class AdminUserListQueryService {
  constructor(private readonly users: IAdminUserBrowseReader) {}

  async getPage(filter: AdminUserListFilter): Promise<AdminUserListPage> {
    const [listResult, summary] = await Promise.all([
      this.users.list(filter),
      this.users.summarize(filter),
    ]);
    return {
      rows: listResult.rows,
      total: summary.total,
      offset: filter.offset,
      limit: filter.limit,
      summary,
    };
  }
}
