import type {
  AdminLotFulfilmentListSort,
  AdminLotFulfilmentListSummary,
  ICollectionBookingReader,
  ILotFulfilmentRepository,
  LotFulfilmentListRow,
  LotFulfilmentRow,
} from "@auction/persistence/interfaces";

/** The collection visit a lot is booked into, as the queue shows it. */
export type LotFulfilmentCollectionVisit = { start: string; end: string; reference: string };

export type AdminLotFulfilmentListRow = LotFulfilmentListRow & {
  /** The live visit holding the lot, or `null` when it is not booked for collection. */
  collectionVisit: LotFulfilmentCollectionVisit | null;
};

export type AdminLotFulfilmentListPage = {
  rows: AdminLotFulfilmentListRow[];
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
  sort?: AdminLotFulfilmentListSort;
};

/** Paginated admin lot fulfilment queue read model (no mutation logic). */
export class AdminLotFulfilmentListQueryService {
  constructor(
    private readonly fulfilment: ILotFulfilmentRepository,
    private readonly bookings: Pick<ICollectionBookingReader, "findLiveByLots">,
  ) {}

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
        ...(filter.sort !== undefined ? { sort: filter.sort } : {}),
      }),
      this.fulfilment.countMatching(listFilter),
      this.fulfilment.summarizeForAdmin(baseFilter),
    ]);
    // One read for the page's lots, not one per row.
    const live = await this.bookings.findLiveByLots(rowsResult.items.map((row) => row.lotId));
    const rows = rowsResult.items.map((row) => {
      const booking = live.get(row.lotId);
      return {
        ...row,
        collectionVisit: booking
          ? {
              start: booking.slotStart.toISOString(),
              end: booking.slotEnd.toISOString(),
              reference: booking.reference,
            }
          : null,
      };
    });
    return {
      rows,
      total,
      offset: filter.offset,
      limit: filter.limit,
      summary,
    };
  }
}
