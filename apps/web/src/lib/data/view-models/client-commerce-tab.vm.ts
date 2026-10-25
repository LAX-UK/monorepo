import type { AdminPaymentRow, AdminUserBidRow } from "@/lib/data/http/admin.server";
import { formatMoney } from "@/lib/format-currency";
import type { StatItem } from "@auction/staff-ui";

export type ClientBidChannelFilter = "all" | "online" | "room" | "telephone";

/** Channel choices for a client's bids, matched against `placedVia`. */
export const CLIENT_BID_CHANNEL_OPTIONS: readonly {
  value: ClientBidChannelFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "online", label: "Online" },
  { value: "room", label: "Room" },
  { value: "telephone", label: "Telephone" },
];

export type ClientBidStatusPresentation = {
  label: "Leading" | "Outbid";
  tone: "info" | "neutral";
};

export function presentClientBidStatus(bid: AdminUserBidRow): ClientBidStatusPresentation {
  return bid.isWinning ? { label: "Leading", tone: "info" } : { label: "Outbid", tone: "neutral" };
}

function normalizePlacedVia(placedVia: string | null | undefined): string {
  return (placedVia ?? "web").trim().toLowerCase();
}

/** How a bid was placed, in the words staff use: web is online, telephone and absentee as named. */
export function clientBidChannelLabel(placedVia: string | null | undefined): string {
  switch (normalizePlacedVia(placedVia)) {
    case "web":
    case "":
      return "Online";
    case "saleroom":
      return "In the room";
    case "telephone":
      return "Telephone";
    case "absentee":
      return "Absentee";
    default: {
      const words = normalizePlacedVia(placedVia).replace(/[_-]+/g, " ");
      return words.charAt(0).toUpperCase() + words.slice(1);
    }
  }
}

export function matchesClientBidChannel(
  bid: AdminUserBidRow,
  filter: ClientBidChannelFilter,
): boolean {
  if (filter === "all") return true;
  const via = normalizePlacedVia(bid.placedVia);
  switch (filter) {
    case "online":
      return via === "web" || via === "";
    case "room":
      return via === "saleroom";
    case "telephone":
      return via === "telephone" || via === "absentee";
    default:
      return true;
  }
}

export function sortClientBidsRecentFirst(bids: readonly AdminUserBidRow[]): AdminUserBidRow[] {
  return [...bids].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function sumCapturedPayments(payments: readonly AdminPaymentRow[]): number {
  return payments
    .filter((payment) => payment.status === "captured")
    .reduce((acc, payment) => acc + Number.parseFloat(payment.amount || "0"), 0);
}

export function sumOutstandingPayments(payments: readonly AdminPaymentRow[]): number {
  return payments
    .filter(
      (payment) =>
        payment.status === "pending" ||
        payment.status === "authorized" ||
        payment.status === "requires_manual_review",
    )
    .reduce((acc, payment) => acc + Number.parseFloat(payment.amount || "0"), 0);
}

/** A decimal amount in pounds ("1250.50") as minor units (125050); null when it is not a number. */
export function decimalToMinorUnits(amount: string | null | undefined): number | null {
  if (amount == null || amount.trim() === "") return null;
  const value = Number.parseFloat(amount);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

export function buildClientPaymentStats(payments: readonly AdminPaymentRow[]): StatItem[] {
  const lifetime = sumCapturedPayments(payments);
  const outstanding = sumOutstandingPayments(payments);

  return [
    {
      id: "lifetime",
      label: "Paid to date",
      value: lifetime > 0 ? formatMoney(lifetime.toFixed(2)) : "—",
      hint: "Captured payments",
    },
    {
      id: "outstanding",
      label: "Outstanding",
      value: outstanding > 0 ? formatMoney(outstanding.toFixed(2)) : "—",
      hint: outstanding > 0 ? "Payment due" : "Nothing due",
      ...(outstanding > 0 ? { hintTone: "negative" as const } : {}),
    },
    { id: "count", label: "Payments", value: String(payments.length), hint: "All statuses" },
  ];
}

export function matchesClientBidSearch(bid: AdminUserBidRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [bid.lotTitle, bid.saleTitle, bid.amount, clientBidChannelLabel(bid.placedVia)].some(
    (field) => field?.toLowerCase().includes(q),
  );
}

export function filterClientBids(
  bids: readonly AdminUserBidRow[],
  options: { search: string; channel: ClientBidChannelFilter },
): AdminUserBidRow[] {
  return sortClientBidsRecentFirst(bids).filter(
    (bid) =>
      matchesClientBidSearch(bid, options.search) && matchesClientBidChannel(bid, options.channel),
  );
}
