import { CatalogKpiCard } from "@/components/admin/catalog/catalog-kpi-card";
import { lotDetailTabHref } from "@/components/admin/lot-detail/lot-detail-types";
import { formatDateTime, formatMoney, formatRelativeTime } from "@/lib/ui/format";
import type { Lot } from "@auction/types";

type Props = {
  lotId: string;
  auction: Lot;
  bidCount: number | null;
};

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

export function AdminLotDetailKpiStrip({ lotId, auction, bidCount }: Props) {
  const reserveHint =
    auction.reservePrice != null && auction.reservePrice !== ""
      ? `Reserve ${formatMoney(auction.reservePrice)}`
      : undefined;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <CatalogKpiCard
        label="Current hammer"
        value={formatMoney(auction.currentPrice)}
        {...(reserveHint ? { hint: reserveHint } : {})}
      />
      <CatalogKpiCard
        label="Starting price"
        value={formatMoney(auction.startingPrice)}
        {...(auction.buyNowPrice ? { hint: `Buy now ${formatMoney(auction.buyNowPrice)}` } : {})}
      />
      <CatalogKpiCard
        label="Schedule"
        value={
          <span className="text-base font-medium">
            {formatDateTime(auction.startTime).split(",")[0] ?? formatDateTime(auction.startTime)}
          </span>
        }
        hint={
          scheduleHint(auction) ??
          `Ends ${formatDateTime(auction.endTime).split(",")[0] ?? formatDateTime(auction.endTime)}`
        }
      />
      <CatalogKpiCard
        label="Bids"
        value={bidCount == null ? "—" : bidCount}
        hint={bidCount != null && bidCount > 0 ? "View bid history" : "No bids yet"}
        {...(bidCount != null && bidCount > 0 ? { href: lotDetailTabHref(lotId, "bids") } : {})}
      />
      <CatalogKpiCard
        label="Images"
        value={auction.images.length}
        hint={auction.images.length === 0 ? "Add images" : "Manage images"}
        href={lotDetailTabHref(lotId, "images")}
      />
    </div>
  );
}
