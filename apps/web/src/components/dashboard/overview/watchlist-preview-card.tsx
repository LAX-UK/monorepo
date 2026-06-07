import { LotThumbnail } from "@/components/dashboard/overview/lot-thumbnail";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { lotStatusLabel } from "@/lib/admin/status-badge-variants";
import { DASHBOARD_CTA, DASHBOARD_EMPTY } from "@/lib/dashboard/dashboard-copy";
import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import { formatMoney } from "@/lib/format-currency";
import { lotPath } from "@/lib/seo/url";
import { Button } from "@auction/ui/components/button";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Surface } from "@auction/ui/components/surface";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

type Variant = "card-list" | "tile-grid";

export function WatchlistPreviewCard({
  vm,
  variant = "card-list",
}: {
  vm: DashboardOverviewVm;
  variant?: Variant;
}) {
  const tileCount = variant === "tile-grid" ? 4 : 2;
  const items = vm.watchPreview.slice(0, tileCount).filter((row) => row.lot);

  return (
    <Surface variant="section" padding="md" className="space-y-4 border-border-hairline">
      <div className="flex flex-row items-center justify-between gap-4">
        <div>
          <h2 className="font-headline text-xl font-semibold tracking-tight text-on-surface md:text-2xl">
            Watchlist
          </h2>
          <p className="font-body text-sm text-on-surface-variant">Saved lots you are tracking.</p>
        </div>
        <Button variant="chevron" asChild>
          <Link href="/dashboard/watchlist" className="inline-flex items-center gap-1 text-xs">
            View all
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
      <div>
        {items.length === 0 ? (
          <DashboardEmptyState
            variant="quiet"
            title={DASHBOARD_EMPTY.watchlist.title}
            description={DASHBOARD_EMPTY.watchlist.description}
            action={
              <Button size="sm" variant="outline" asChild className="shrink-0">
                <Link href="/search">{DASHBOARD_CTA.browseLiveAuctions}</Link>
              </Button>
            }
          />
        ) : variant === "tile-grid" ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.map((row) => {
              const lot = row.lot;
              if (!lot) return null;
              return (
                <li key={row.watchlistId}>
                  <Link
                    href={lotPath(lot)}
                    className="flex min-h-16 items-center gap-3 rounded-xl border border-border-hairline bg-surface-container-low p-3 transition-colors hover:bg-surface-container-high/50"
                  >
                    <LotThumbnail
                      src={lot.images[0]}
                      alt={`${lot.title} thumbnail`}
                      className="size-12 rounded-md"
                      sizes="48px"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-headline text-sm font-semibold text-on-surface">
                        {lot.title}
                      </span>
                      <span className="mt-1 block font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
                        Est. {formatMoney(lot.currentPrice)}
                      </span>
                    </span>
                    <StatusBadge variant={lot.status === "active" ? "live" : "neutral"}>
                      {lotStatusLabel[lot.status] ?? lot.status}
                    </StatusBadge>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="divide-y divide-outline-variant/10">
            {items.map((row) => {
              const lot = row.lot;
              if (!lot) return null;
              return (
                <li key={row.watchlistId}>
                  <Link
                    href={lotPath(lot)}
                    className="flex min-h-16 items-center gap-3 py-3 transition-colors hover:bg-surface-container-low/45 sm:px-2"
                  >
                    <LotThumbnail
                      src={lot.images[0]}
                      alt={`${lot.title} thumbnail`}
                      className="size-12 rounded-lg"
                      sizes="48px"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-headline text-sm font-semibold text-on-surface">
                        {lot.title}
                      </span>
                      <span className="mt-1 block font-label text-xs uppercase tracking-wider text-secondary">
                        Est. {formatMoney(lot.currentPrice)}
                      </span>
                    </span>
                    <StatusBadge variant={lot.status === "active" ? "live" : "neutral"}>
                      {lotStatusLabel[lot.status] ?? lot.status}
                    </StatusBadge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Surface>
  );
}
