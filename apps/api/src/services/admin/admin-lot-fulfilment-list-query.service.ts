import type {
  AdminLotFulfilmentListSort,
  AdminLotFulfilmentListSummary,
  ICollectionBookingReader,
  IDeliveryPaidWithInvoiceReader,
  ILotFulfilmentRepository,
  LotFulfilmentListRow,
  LotFulfilmentRow,
} from "@auction/persistence/interfaces";

/** The collection visit a lot is booked into, as the queue shows it. */
export type LotFulfilmentCollectionVisit = { start: string; end: string };

/**
 * A courier charge the buyer already paid inside a combined payment ("paid with invoice"), so
 * staff do not take it again by hand. Refunds of it name the group and the quote.
 */
export type LotFulfilmentCourierPaid = {
  paymentGroupId: string;
  deliveryQuoteId: string;
  /** Pounds charged, as a decimal string. */
  amount: string;
  /** What has gone back to the buyer for it so far, in pence. */
  refundedPence: number;
  /** ISO timestamp of when the combined payment was paid, when known. */
  paidAt: string | null;
};

export type AdminLotFulfilmentListRow = LotFulfilmentListRow & {
  /** The live visit holding the lot, or `null` when it is not booked for collection. */
  collectionVisit: LotFulfilmentCollectionVisit | null;
  /** Courier charges paid with the invoice; empty when none was. */
  courierPaidWithInvoice: LotFulfilmentCourierPaid[];
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
    private readonly paidDeliveries: Pick<IDeliveryPaidWithInvoiceReader, "findByLots">,
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
    // One read each for the page's lots, not one per row.
    const lotIds = rowsResult.items.map((row) => row.lotId);
    const [live, paid] = await Promise.all([
      this.bookings.findLiveByLots(lotIds),
      this.paidDeliveries.findByLots(lotIds),
    ]);
    const rows = rowsResult.items.map((row) => {
      const booking = live.get(row.lotId);
      return {
        ...row,
        collectionVisit: booking
          ? {
              start: booking.slotStart.toISOString(),
              end: booking.slotEnd.toISOString(),
            }
          : null,
        courierPaidWithInvoice: (paid.get(row.lotId) ?? []).map((d) => ({
          paymentGroupId: d.paymentGroupId,
          deliveryQuoteId: d.deliveryQuoteId,
          amount: d.amount,
          refundedPence: d.refundedPence,
          paidAt: d.paidAt ? d.paidAt.toISOString() : null,
        })),
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
