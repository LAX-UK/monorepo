import type {
  AdminPaymentTableRowDto,
  AdminPaymentsSummaryStats,
  IPaymentWriteRepository,
  ListPaymentsAdminTableFilter,
} from "@auction/persistence/interfaces";

export type AdminPaymentListPage = {
  rows: AdminPaymentTableRowDto[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminPaymentsSummaryStats;
};

/** Paginated admin payments table read model (no KPI or capture logic). */
export class AdminPaymentListQueryService {
  constructor(private readonly payments: IPaymentWriteRepository) {}

  async getPage(filter: ListPaymentsAdminTableFilter): Promise<AdminPaymentListPage> {
    const tableFilter = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.q ? { q: filter.q } : {}),
      ...(filter.fulfilmentStatuses?.length
        ? { fulfilmentStatuses: filter.fulfilmentStatuses }
        : {}),
      ...(filter.xeroInvoice ? { xeroInvoice: filter.xeroInvoice } : {}),
    };
    const [rows, total, summary] = await Promise.all([
      this.payments.listForAdminTable(filter),
      this.payments.countForAdminTable(tableFilter),
      this.payments.summarizeForAdminTable(tableFilter),
    ]);
    return { rows, total, offset: filter.offset, limit: filter.limit, summary };
  }
}
