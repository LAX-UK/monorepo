import { LotThumbnail } from "@/components/dashboard/overview/lot-thumbnail";
import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import { formatMoney } from "@/lib/format-currency";
import { lotPath } from "@/lib/seo/url";
import { Button } from "@auction/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { StatusBadge } from "@auction/ui/components/status-badge";
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
    <Card className="border-outline-variant/15 shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="font-headline text-xl font-semibold tracking-tight md:text-2xl">
            Watchlist
          </CardTitle>
          <CardDescription>Saved lots you are tracking.</CardDescription>
        </div>
        <Button variant="chevron" asChild>
          <Link href="/dashboard/watchlist" className="inline-flex items-center gap-1 text-xs">
            View all
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-outline-variant/25 bg-surface-container-low/40 p-5 text-sm text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
            <span>Save lots from artwork pages to build a personal watchlist.</span>
            <Button size="sm" variant="outline" asChild className="shrink-0">
              <Link href="/search">Browse auctions</Link>
            </Button>
          </div>
        ) : variant === "tile-grid" ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.map((row) => {
              const lot = row.lot;
              if (!lot) return null;
              return (
                <li key={row.watchlistId}>
                  <Link
                    href={lotPath(lot)}
                    className="flex min-h-16 items-center gap-3 rounded-xl border border-outline-variant/15 bg-surface-container-low p-3 transition-colors hover:bg-surface-container-high/50"
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
                      {lot.status}
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
                      {lot.status}
                    </StatusBadge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
