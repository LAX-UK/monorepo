import type { IAdminSaleReadinessReader } from "@auction/persistence/interfaces";
import { type StaffRoles, type UserRole, adminRoutes, canOpenAdminLink } from "@auction/types";
import type { AdminSaleReadinessRowDto } from "@auction/validators";

/**
 * The readiness rows with only the links this person can open: blockers they cannot act on are
 * left out, and a sale they cannot open in the sale pages opens in the saleroom console instead.
 */
export function saleReadinessForViewer(
  rows: readonly AdminSaleReadinessRowDto[],
  role: UserRole,
  staffRoles: StaffRoles | undefined,
): AdminSaleReadinessRowDto[] {
  return rows.map((row) => ({
    ...row,
    blockers: row.blockers.filter((blocker) => canOpenAdminLink(role, staffRoles, blocker.href)),
    href: canOpenAdminLink(role, staffRoles, row.href)
      ? row.href
      : adminRoutes.saleroom.console(row.saleId),
  }));
}

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
          href: adminRoutes.sale.lots(row.saleId),
        });
      }
      if (row.lotsMissingPhotos > 0) {
        blockers.push({
          id: "missing-photos",
          label: `${row.lotsMissingPhotos} missing photos`,
          count: row.lotsMissingPhotos,
          href: adminRoutes.sale.lots(row.saleId),
        });
      }
      if (row.lotsMissingEstimates > 0) {
        blockers.push({
          id: "missing-estimates",
          label: `${row.lotsMissingEstimates} missing estimates`,
          count: row.lotsMissingEstimates,
          href: adminRoutes.sale.lots(row.saleId),
        });
      }
      if (row.pendingRegistrations > 0) {
        blockers.push({
          id: "pending-registrations",
          label: `${row.pendingRegistrations} pending registration${row.pendingRegistrations === 1 ? "" : "s"}`,
          count: row.pendingRegistrations,
          href: adminRoutes.sale.registrations(row.saleId, "pending"),
        });
      }
      if (row.pendingTelephoneBookings > 0) {
        blockers.push({
          id: "pending-telephone",
          label: `${row.pendingTelephoneBookings} telephone booking${row.pendingTelephoneBookings === 1 ? "" : "s"}`,
          count: row.pendingTelephoneBookings,
          href: adminRoutes.sale.telephoneBookings(row.saleId, "requested"),
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
        href: adminRoutes.sale.detail(row.saleId),
        consoleHref: isLive && isOnsite ? adminRoutes.saleroom.console(row.saleId) : null,
      };
    });
  }
}
