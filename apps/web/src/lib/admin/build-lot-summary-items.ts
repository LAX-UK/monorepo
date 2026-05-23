import type { CatalogDetailSummaryItem } from "@/components/admin/catalog";
import { lotDetailTabHref } from "@/components/admin/lot-detail/lot-detail-types";
import { formatDateTime, formatMoney, formatRelativeTime } from "@/lib/ui/format";
import type { Lot } from "@auction/types";

function scheduleHint(auction: Lot): string | undefined {
  const now = Date.now();
  if (auction.status === "active" && auction.endTime.getTime() > now) {
    return `Ends ${formatRelativeTime(auction.endTime)}`;
  }
  if (auction.status === "scheduled" && auction.startTime.getTime() > now) {
    return `Starts ${formatRelativeTime(auction.startTime)}`;
  }
  return undefined;
}

export function buildLotSummaryItems(
  lotId: string,
  auction: Lot,
  bidCount: number | null,
): CatalogDetailSummaryItem[] {
  const reserveHint =
    auction.reservePrice != null && auction.reservePrice !== ""
      ? `Reserve ${formatMoney(auction.reservePrice)}`
      : undefined;
  const scheduleStart =
    formatDateTime(auction.startTime).split(",")[0] ?? formatDateTime(auction.startTime);
  const scheduleEnd =
    formatDateTime(auction.endTime).split(",")[0] ?? formatDateTime(auction.endTime);

  return [
    {
      id: "hammer",
      label: "Current hammer",
      value: formatMoney(auction.currentPrice),
      ...(reserveHint ? { hint: reserveHint } : {}),
    },
    {
      id: "starting",
      label: "Starting price",
      value: formatMoney(auction.startingPrice),
      ...(auction.buyNowPrice ? { hint: `Buy now ${formatMoney(auction.buyNowPrice)}` } : {}),
    },
    {
      id: "schedule",
      label: "Schedule",
      value: scheduleStart,
      hint: scheduleHint(auction) ?? `Ends ${scheduleEnd}`,
    },
    {
      id: "bids",
      label: "Bids",
      value: bidCount == null ? "—" : bidCount,
      hint: bidCount != null && bidCount > 0 ? "View bid history" : "No bids yet",
      ...(bidCount != null && bidCount > 0 ? { href: lotDetailTabHref(lotId, "bids") } : {}),
    },
    {
      id: "images",
      label: "Images",
      value: auction.images.length,
      hint: auction.images.length === 0 ? "Add images" : "Manage images",
      href: lotDetailTabHref(lotId, "images"),
    },
  ];
}
