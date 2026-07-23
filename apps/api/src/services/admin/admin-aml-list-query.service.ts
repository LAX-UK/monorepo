import type {
  AdminAmlListSummary,
  IWatchlistScreeningReader,
  WatchlistScreeningRecord,
} from "@auction/persistence/interfaces";

export type AdminAmlListPage = {
  rows: WatchlistScreeningRecord[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminAmlListSummary;
};

/** Paginated admin AML pending-review queue (no mutation logic). */
export class AdminAmlListQueryService {
  constructor(private readonly screenings: IWatchlistScreeningReader) {}

  async getPage(input: { limit: number; offset: number }): Promise<AdminAmlListPage> {
    const [rows, summary] = await Promise.all([
      this.screenings.listByReviewStatus("pending", input.limit, input.offset),
      this.screenings.summarizePendingQueue(),
    ]);
    return {
      rows,
      total: summary.total,
      offset: input.offset,
      limit: input.limit,
      summary,
    };
  }

  async getPendingById(id: string): Promise<WatchlistScreeningRecord | null> {
    const row = await this.screenings.findById(id);
    if (!row || row.reviewStatus !== "pending") return null;
    return row;
  }
}
