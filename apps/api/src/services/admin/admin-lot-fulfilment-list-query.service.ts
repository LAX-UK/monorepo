import type {
  AdminLotFulfilmentListSummary,
  ILotFulfilmentRepository,
  LotFulfilmentListRow,
  LotFulfilmentRow,
} from "@auction/persistence/interfaces";

export type AdminLotFulfilmentListPage = {
  rows: LotFulfilmentListRow[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminLotFulfilmentListSummary;
};

export type AdminLotFulfilmentListQueryFilter = {
  q?: string;
  status?: LotFulfilmentRow["status"];
  limit: number;
  offset: number;
};

/** Paginated admin lot fulfilment queue read model (no mutation logic). */
export class AdminLotFulfilmentListQueryService {
  constructor(private readonly fulfilment: ILotFulfilmentRepository) {}

  async getPage(filter: AdminLotFulfilmentListQueryFilter): Promise<AdminLotFulfilmentListPage> {
    const baseFilter = {
      ...(filter.q ? { q: filter.q } : {}),
    };
    const listFilter = {
      ...baseFilter,
      ...(filter.status !== undefined ? { status: filter.status } : {}),
    };
    const [rowsResult, total, summary] = await Promise.all([
      this.fulfilment.listForAdmin({
        ...listFilter,
        limit: filter.limit,
        offset: filter.offset,
      }),
      this.fulfilment.countMatching(listFilter),
      this.fulfilment.summarizeForAdmin(baseFilter),
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
