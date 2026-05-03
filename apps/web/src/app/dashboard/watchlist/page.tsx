import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs";
import {
  WatchlistBoard,
  type WatchlistBoardRow,
  estimateLabel,
} from "@/components/dashboard/watchlist-board";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { WatchlistWithLotRow } from "@/lib/data/http/dashboard.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";
import Link from "next/link";
import { Suspense } from "react";

function toWatchlistRows(rows: WatchlistWithLotRow[]): WatchlistBoardRow[] {
  return rows.flatMap((row) => {
    const lot = row.lot;
    if (!lot) return [];

    return [
      {
        watchlistId: row.watchlistId,
        lotId: lot.id,
        title: lot.title,
        artistLabel: lot.marketingDetails.sellerArtistId ?? lot.sellerId,
        image: lot.images[0] ?? null,
        medium: lot.medium,
        lotNumber: lot.lotNumber,
        estimateLabel: estimateLabel({
          estimate: lot.marketingDetails.estimate,
          fallback: lot.currentPrice,
        }),
        status: lot.status,
        startTime: lot.startTime.toISOString(),
        endTime: lot.endTime.toISOString(),
      },
    ];
  });
}

export default async function DashboardWatchlistPage() {
  const c = await getServerDataContainer();
  let rows: Awaited<ReturnType<typeof c.watchlist.listMine>> = [];
  let err: string | null = null;

  try {
    rows = await c.watchlist.listMine();
  } catch (e) {
    err = e instanceof Error ? e.message : "Could not load watchlist.";
  }

  const tableRows = toWatchlistRows(rows);

  return (
    <div className="screen w-full space-y-6">
      <PageHeader
        title="Watchlist"
        description="Track lots and artists you are following from the saleroom."
        className="border-0 pb-0"
      />

      <DashboardSectionTabs
        ariaLabel="Watchlist sections"
        className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-3"
        items={[
          { href: "/dashboard/watchlist", label: "Lots", isActive: true },
          { href: "/dashboard/artist-follow", label: "Artists" },
        ]}
      />

      {err ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load watchlist</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}

      {!err && tableRows.length === 0 ? (
        <EmptyState
          title="No watched lots yet"
          description="Save lots from artwork pages to monitor their status and closing time here."
          action={
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 font-label text-xs font-semibold uppercase tracking-widest text-on-primary"
            >
              Browse auctions
            </Link>
          }
        />
      ) : null}

      {!err && tableRows.length > 0 ? (
        <Suspense fallback={<PageSkeleton variant="table" />}>
          <WatchlistBoard rows={tableRows} />
        </Suspense>
      ) : null}
    </div>
  );
}
