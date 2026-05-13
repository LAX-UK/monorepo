import { type PaymentStatus, paymentStatuses } from "@auction/types";

/** "All" sentinel keeps the filter set finite and parse-safe. */
export type PaymentsStatusFilter = "all" | PaymentStatus;

export const PAYMENTS_STATUS_FILTER_OPTIONS: Array<{
  value: PaymentsStatusFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Awaiting payment" },
  { value: "captured", label: "Paid" },
  { value: "refunded", label: "Refunded" },
  { value: "requires_manual_review", label: "Manual review" },
];

/** Parse `?status=` into a known filter value. Unknown / missing → `"all"`. */
export function parsePaymentsStatusFilter(raw: string | undefined | null): PaymentsStatusFilter {
  if (!raw) return "all";
  if (raw === "all") return "all";
  return (paymentStatuses as readonly string[]).includes(raw) ? (raw as PaymentStatus) : "all";
}

/** Build a URL with the filter applied (or removed when `all`). Caller passes
 * the current pathname; we only mutate the `status` query parameter. */
export function paymentsFilterHref(pathname: string, filter: PaymentsStatusFilter): string {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("status", filter);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
