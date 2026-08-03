import type { IAdminSaleReadinessReader } from "@auction/persistence/interfaces";
import type { AdminSaleReadinessRowDto } from "@auction/validators";

export class AdminSaleReadinessService {
  constructor(private readonly reader: IAdminSaleReadinessReader) {}

  async listReadiness(limit: number): Promise<AdminSaleReadinessRowDto[]> {
    const rows = await this.reader.listUpcomingAndLiveSales(limit);
    const now = Date.now();

    return rows.map((row) => {
      const daysToStart =
        row.startTime != null
          ? Math.ceil((row.startTime.getTime() - now) / (24 * 60 * 60 * 1000))
          : null;

      const blockers: AdminSaleReadinessRowDto["blockers"] = [];

      if (row.lotsDraft > 0) {
        blockers.push({
          id: "draft-lots",
          label: `${row.lotsDraft} draft lot${row.lotsDraft === 1 ? "" : "s"}`,
          count: row.lotsDraft,
          href: `/admin/sales/${row.saleId}?tab=catalog`,
        });
      }
      if (row.lotsMissingPhotos > 0) {
        blockers.push({
          id: "missing-photos",
          label: `${row.lotsMissingPhotos} missing photos`,
          count: row.lotsMissingPhotos,
          href: `/admin/sales/${row.saleId}?tab=catalog`,
        });
      }
      if (row.lotsMissingEstimates > 0) {
        blockers.push({
          id: "missing-estimates",
          label: `${row.lotsMissingEstimates} missing estimates`,
          count: row.lotsMissingEstimates,
          href: `/admin/sales/${row.saleId}?tab=catalog`,
        });
      }
      if (row.pendingRegistrations > 0) {
        blockers.push({
          id: "pending-registrations",
          label: `${row.pendingRegistrations} pending registration${row.pendingRegistrations === 1 ? "" : "s"}`,
          count: row.pendingRegistrations,
          href: `/admin/sales/${row.saleId}/registrations?status=pending`,
        });
      }
      if (row.pendingTelephoneBookings > 0) {
        blockers.push({
          id: "pending-telephone",
          label: `${row.pendingTelephoneBookings} telephone booking${row.pendingTelephoneBookings === 1 ? "" : "s"}`,
          count: row.pendingTelephoneBookings,
          href: `/admin/sales/${row.saleId}/telephone-bookings?status=requested`,
        });
      }

      const isLive = row.status === "active";
      const isOnsite = row.deliveryMode === "onsite" || row.deliveryMode === "hybrid";

      return {
        saleId: row.saleId,
        title: row.title,
        status: row.status,
        deliveryMode: row.deliveryMode,
        startTime: row.startTime?.toISOString() ?? null,
        daysToStart,
        lotsTotal: row.lotsTotal,
        lotsPublished: row.lotsPublished,
        lotsDraft: row.lotsDraft,
        lotsMissingPhotos: row.lotsMissingPhotos,
        lotsMissingEstimates: row.lotsMissingEstimates,
        pendingRegistrations: row.pendingRegistrations,
        pendingTelephoneBookings: row.pendingTelephoneBookings,
        sessionStatus: row.sessionStatus,
        blockers,
        href: `/admin/sales/${row.saleId}`,
        consoleHref: isLive && isOnsite ? `/admin/saleroom/${row.saleId}` : null,
      };
    });
  }
}
