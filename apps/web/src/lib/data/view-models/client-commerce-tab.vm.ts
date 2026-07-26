import type { DetailCardGridItem } from "@/components/admin/catalog/detail-board/detail-card-grid";
import type { DetailBoardFilter, DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
import type { AdminPaymentRow, AdminUserBidRow } from "@/lib/data/http/admin.server";
import { formatMoney } from "@/lib/format-currency";
import type { Lot } from "@auction/types";
import type { DotStatusPillTone } from "@auction/ui/components/dot-status-pill";
import type { ReactNode } from "react";

export type ClientBidChannelFilter = "all" | "online" | "room" | "telephone";

/** Channel filter chips — maps to existing `placedVia` values only. */
export const CLIENT_BID_CHANNEL_FILTERS: DetailBoardFilter<ClientBidChannelFilter>[] = [
  { id: "all", label: "All" },
  { id: "online", label: "Online" },
  { id: "room", label: "Room" },
  { id: "telephone", label: "Telephone" },
];

export type ClientBidStatusPresentation = {
  label: "Leading" | "Outbid";
  tone: DotStatusPillTone;
};

export function presentClientBidStatus(bid: AdminUserBidRow): ClientBidStatusPresentation {
  return bid.isWinning ? { label: "Leading", tone: "info" } : { label: "Outbid", tone: "neutral" };
}

function normalizePlacedVia(placedVia: string | null | undefined): string {
  return (placedVia ?? "web").trim().toLowerCase();
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

export function buildClientPaymentsKpiTiles(
  payments: readonly AdminPaymentRow[],
): DetailBoardKpiTile[] {
  const lifetime = sumCapturedPayments([...payments]);
  const outstanding = sumOutstandingPayments(payments);

  return [
    {
      id: "lifetime",
      label: "Lifetime spend",
      value: lifetime > 0 ? formatMoney(lifetime.toFixed(2)) : "—",
      compareHint: "Captured payments",
      trendTone: lifetime > 0 ? "accent-gold" : "muted",
    },
    {
      id: "outstanding",
      label: "Outstanding",
      value: outstanding > 0 ? formatMoney(outstanding.toFixed(2)) : "—",
      compareHint: outstanding > 0 ? "Payment due" : "Nothing due",
      trendTone: outstanding > 0 ? "accent-gold" : "muted",
    },
    {
      id: "count",
      label: "Payments",
      value: String(payments.length),
      compareHint: "All statuses",
      trendTone: "secondary",
    },
  ];
}

export function buildClientWonLotGridItems(
  wonLots: readonly Lot[],
  renderImage: (lot: Lot) => ReactNode,
): DetailCardGridItem[] {
  return wonLots.map((lot) => ({
    id: lot.id,
    href: `/admin/lots/${lot.id}`,
    image: renderImage(lot),
    title: lot.lotNumber != null ? `Lot#${lot.lotNumber}` : lot.title,
    subtitle: lot.lotNumber != null ? lot.title : undefined,
    badge: { label: "Winning", tone: "success" as const },
    meta: formatMoney(lot.currentPrice),
  }));
}

export function sortPaymentsRecentFirst(payments: readonly AdminPaymentRow[]): AdminPaymentRow[] {
  return [...payments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function matchesClientPaymentSearch(payment: AdminPaymentRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [payment.id, payment.lotId, payment.status, payment.amount].some((field) =>
    field.toLowerCase().includes(q),
  );
}

export function matchesClientBidSearch(bid: AdminUserBidRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [bid.lotTitle, bid.saleTitle, bid.amount, bid.placedVia, bid.lotId].some((field) =>
    field?.toLowerCase().includes(q),
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
