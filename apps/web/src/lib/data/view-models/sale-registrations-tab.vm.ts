import type { AdminSaleRegistrationRow } from "@/lib/data/http/admin-sale-registrations.types";
import type { SegmentOption, StatusPresentation } from "@auction/staff-ui";

export type SaleRegistrationsFilter =
  | "all"
  | "approved"
  | "pending"
  | "rejected"
  | "checked_in"
  | "awaiting";

const ONLINE_FILTERS: SegmentOption<SaleRegistrationsFilter>[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const SALEROOM_FILTERS: SegmentOption<SaleRegistrationsFilter>[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "awaiting", label: "Awaiting paddle" },
  { value: "checked_in", label: "Checked in" },
];

/** The status filters a sale offers: saleroom sales track paddles and check-in instead of rejections. */
export function saleRegistrationsFilters(
  saleroom: boolean,
): readonly SegmentOption<SaleRegistrationsFilter>[] {
  return saleroom ? SALEROOM_FILTERS : ONLINE_FILTERS;
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
    case "rejected":
      return rows.filter((r) => r.status === "rejected");
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
  return row.userName ?? row.userEmail ?? "Unnamed bidder";
}

/** Where an approved bidder stands at the door: checked in, waiting for a paddle, or ready. */
export function registrationCheckInStatus(
  row: AdminSaleRegistrationRow,
): StatusPresentation | null {
  if (row.checkedInAt) return { label: "Checked in", tone: "success" };
  if (row.status !== "approved") return null;
  if (row.paddleNumber == null) return { label: "Awaiting paddle", tone: "warning" };
  return { label: "Paddle assigned", tone: "info" };
}
