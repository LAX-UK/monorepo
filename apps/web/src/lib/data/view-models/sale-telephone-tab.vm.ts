import type { AdminTelephoneBookingRow } from "@/lib/data/http/admin.server";
import { telephoneBookingStatusLabel } from "@/lib/telephone/telephone-booking-types";
import type { SegmentOption } from "@auction/staff-ui";

export type SaleTelephoneFilter = "all" | "active" | "requested" | "closed";

export const SALE_TELEPHONE_FILTERS: readonly SegmentOption<SaleTelephoneFilter>[] = [
  { value: "all", label: "All" },
  { value: "requested", label: "Requested" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
];

/** A booking that has finished, one way or the other. */
export function isTelephoneBookingClosed(row: Pick<AdminTelephoneBookingRow, "status">): boolean {
  return row.status === "cancelled" || row.status === "completed";
}

export function filterSaleTelephoneBookings(
  rows: readonly AdminTelephoneBookingRow[],
  filter: SaleTelephoneFilter,
): AdminTelephoneBookingRow[] {
  switch (filter) {
    case "active":
      return rows.filter((r) => !isTelephoneBookingClosed(r));
    case "requested":
      return rows.filter((r) => r.status === "requested");
    case "closed":
      return rows.filter(isTelephoneBookingClosed);
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
  return row.userName ?? row.userEmail ?? "Unnamed bidder";
}
