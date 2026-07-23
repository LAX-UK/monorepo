import type { DetailBoardFilter, DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
import type { AdminSaleRegistrationRow } from "@/lib/data/http/admin-sale-registrations.types";
import { registrationDotStatus } from "@/lib/presenters/status/dot-status-presenters";
import type { DotStatusPillTone } from "@auction/ui";

export type SaleRegistrationsFilter = "all" | "approved" | "pending" | "checked_in" | "awaiting";

export const SALE_REGISTRATIONS_FILTERS: DetailBoardFilter<SaleRegistrationsFilter>[] = [
  { id: "all", label: "All" },
  { id: "approved", label: "Approved" },
  { id: "pending", label: "Pending" },
  { id: "checked_in", label: "Checked in" },
  { id: "awaiting", label: "Awaiting" },
];

export function buildSaleRegistrationsKpiTiles(
  rows: readonly AdminSaleRegistrationRow[],
): DetailBoardKpiTile[] {
  const pending = rows.filter((r) => r.status === "pending").length;
  const approved = rows.filter((r) => r.status === "approved").length;
  const checkedIn = rows.filter((r) => r.checkedInAt != null).length;
  const rejected = rows.filter((r) => r.status === "rejected").length;
  const checkedInPct =
    approved > 0 ? `${Math.round((checkedIn / approved) * 1000) / 10}% of approved` : "—";

  return [
    {
      id: "total",
      label: "Total registrations",
      value: String(rows.length),
      compareHint: pending > 0 ? `${pending} pending` : "On file",
    },
    {
      id: "checked-in",
      label: "Checked in",
      value: String(checkedIn),
      compareHint: checkedInPct,
    },
    {
      id: "rejected",
      label: "Rejected",
      value: String(rejected),
      compareHint: rejected > 0 ? "Needs review" : "None flagged",
    },
  ];
}

export function filterSaleRegistrations(
  rows: readonly AdminSaleRegistrationRow[],
  filter: SaleRegistrationsFilter,
): AdminSaleRegistrationRow[] {
  switch (filter) {
    case "approved":
      return rows.filter((r) => r.status === "approved");
    case "pending":
      return rows.filter((r) => r.status === "pending");
    case "checked_in":
      return rows.filter((r) => r.checkedInAt != null);
    case "awaiting":
      return rows.filter((r) => r.status === "approved" && r.paddleNumber == null);
    default:
      return [...rows];
  }
}

export function matchesSaleRegistrationSearch(
  row: AdminSaleRegistrationRow,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const fields = [
    row.userName,
    row.userEmail,
    row.buyerLegalEntityDisplayName,
    row.paddleNumber != null ? String(row.paddleNumber) : null,
  ];
  return fields.some((f) => f?.toLowerCase().includes(q));
}

export function registrationBidderLabel(row: AdminSaleRegistrationRow): string {
  return row.userName ?? row.userEmail ?? row.userId;
}

export function registrationStatusTone(
  status: AdminSaleRegistrationRow["status"],
): DotStatusPillTone {
  return registrationDotStatus(status).tone;
}

export function registrationStatusLabel(status: AdminSaleRegistrationRow["status"]): string {
  return registrationDotStatus(status).label;
}

export function registrationCheckInTone(row: AdminSaleRegistrationRow): DotStatusPillTone {
  if (row.checkedInAt) return "success";
  if (row.status === "approved" && row.paddleNumber == null) return "warning";
  if (row.status === "approved") return "info";
  return "neutral";
}

export function registrationCheckInLabel(row: AdminSaleRegistrationRow): string {
  if (row.checkedInAt) return "Checked in";
  if (row.status === "approved" && row.paddleNumber == null) return "Awaiting paddle";
  if (row.status === "approved") return "Approved";
  return "—";
}
