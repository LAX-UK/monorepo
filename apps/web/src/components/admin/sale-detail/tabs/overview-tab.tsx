import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { CatalogInfoCard } from "@/components/admin/catalog";
import {
  buyerPremiumSummary,
  sumLotHammers,
} from "@/components/admin/sale-detail/sale-detail-helpers";
import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import type { Lot, Sale } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  liveish: boolean;
  isOnsite: boolean;
  venueLines: string[];
  registrationCount: number | null;
};

export function SaleOverviewTab({
  saleId,
  sale,
  lots,
  liveish,
  isOnsite,
  venueLines,
  registrationCount,
}: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CatalogInfoCard title="Status">
        <AdminStatusBadge domain="sale" status={sale.status} />
      </CatalogInfoCard>
      <CatalogInfoCard title="Delivery">
        <span className="capitalize">{sale.deliveryMode}</span>
        {sale.streamUrl ? (
          <p className="mt-2 break-all font-mono text-xs text-on-surface-variant">
            Stream: {sale.streamUrl}
          </p>
        ) : null}
      </CatalogInfoCard>
      <CatalogInfoCard title="Buyer premium">
        <p className="font-body text-sm text-on-surface">{buyerPremiumSummary(sale)}</p>
      </CatalogInfoCard>
      <CatalogInfoCard title="Lots & hammer">
        <p className="font-body text-sm">
          <span className="font-medium text-on-surface">{lots.length}</span> lot
          {lots.length === 1 ? "" : "s"}
        </p>
        <p className="mt-1 text-xs text-on-surface-variant">
          Aggregate current hammer:{" "}
          <span className="font-medium tabular-nums text-on-surface">{sumLotHammers(lots)}</span>
        </p>
      </CatalogInfoCard>
      {isOnsite && venueLines.length > 0 ? (
        <CatalogInfoCard title="Venue" className="sm:col-span-2">
          <ul className="list-inside list-disc space-y-1 font-body text-sm text-on-surface-variant">
            {venueLines.map((line, i) => (
              <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
            ))}
          </ul>
          {sale.locationMapUrl ? (
            <p className="mt-2">
              <Link
                href={sale.locationMapUrl}
                target="_blank"
                rel="noreferrer"
                className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
              >
                Open map ↗
              </Link>
            </p>
          ) : null}
        </CatalogInfoCard>
      ) : null}
      {liveish ? (
        <CatalogInfoCard title="Saleroom & registrations" className="sm:col-span-2">
          <p className="font-body text-sm text-on-surface-variant">
            {registrationCount != null && registrationCount > 0
              ? `${registrationCount} ${isOnsite ? "paddle" : "bidder"} registration${registrationCount === 1 ? "" : "s"}`
              : "No registrations yet — review before going live."}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href={saleDetailTabHref(saleId, "registrations")}>
                {isOnsite ? "Paddle registrations" : "Bidder registrations"}
                {registrationCount != null && registrationCount > 0
                  ? ` (${registrationCount})`
                  : ""}
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/admin/saleroom/${saleId}`}>Open saleroom</Link>
            </Button>
          </div>
        </CatalogInfoCard>
      ) : null}
    </div>
  );
}
