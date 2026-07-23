import type { DetailBoardFilter, DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
import type { AdminTelephoneBookingRow } from "@/lib/data/http/admin.server";
import { telephoneBookingStatusLabel } from "@/lib/telephone/telephone-booking-types";

export type SaleTelephoneFilter = "all" | "active" | "requested" | "completed";

export const SALE_TELEPHONE_FILTERS: DetailBoardFilter<SaleTelephoneFilter>[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "requested", label: "Requested" },
  { id: "completed", label: "Completed" },
];

export function buildSaleTelephoneKpiTiles(
  rows: readonly AdminTelephoneBookingRow[],
): DetailBoardKpiTile[] {
  const requested = rows.filter((r) => r.status === "requested").length;
  const inProgress = rows.filter(
    (r) => r.status === "in_progress" || r.status === "confirmed",
  ).length;
  const completed = rows.filter((r) => r.status === "completed").length;
  const cancelled = rows.filter((r) => r.status === "cancelled").length;

  return [
    {
      id: "total",
      label: "Total bookings",
      value: String(rows.length),
      compareHint: requested > 0 ? `${requested} awaiting confirm` : "On file",
    },
    {
      id: "active",
      label: "Active lines",
      value: String(inProgress),
      compareHint: inProgress > 0 ? "Clerk may be on line" : "None in progress",
    },
    {
      id: "completed",
      label: "Completed",
      value: String(completed),
      compareHint: cancelled > 0 ? `${cancelled} cancelled` : "Closed lines",
    },
  ];
}

export function filterSaleTelephoneBookings(
  rows: readonly AdminTelephoneBookingRow[],
  filter: SaleTelephoneFilter,
): AdminTelephoneBookingRow[] {
  switch (filter) {
    case "active":
      return rows.filter((r) => r.status !== "cancelled" && r.status !== "completed");
    case "requested":
      return rows.filter((r) => r.status === "requested");
    case "completed":
      return rows.filter((r) => r.status === "completed" || r.status === "cancelled");
    default:
      return [...rows];
  }
}

export function matchesSaleTelephoneSearch(row: AdminTelephoneBookingRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const fields = [
    row.userName,
    row.userEmail,
    row.buyerLegalEntityDisplayName,
    row.phoneDisplay,
    row.phoneE164,
    telephoneBookingStatusLabel(row.status),
  ];
  return fields.some((f) => f?.toLowerCase().includes(q));
}

export function telephoneBidderLabel(row: AdminTelephoneBookingRow): string {
  return row.userName ?? row.userEmail ?? row.userId;
}
