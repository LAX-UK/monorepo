import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getServerMyBids,
  getServerMyPortfolio,
  getServerMyWatchlist,
} from "@/lib/data/http/dashboard.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { formatMoney } from "@/lib/format-currency";
import { portfolioSettlementLabel } from "@/lib/portfolio-settlement";
import type { Lot } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { PageHeader } from "@auction/ui/components/page-header";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

function DashboardHomeFallback() {
  return (
    <div className="max-w-[1920px] space-y-10" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-4 w-48" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(["kpi-a", "kpi-b", "kpi-c", "kpi-d"] as const).map((id) => (
          <Skeleton key={id} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <div className="space-y-4 lg:col-span-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

async function DashboardHomeContent() {
  const user = await getServerSessionUser();
  const reader = await getServerLotReader();

  let active: Lot[] = [];
  let portfolio: Awaited<ReturnType<typeof getServerMyPortfolio>> = [];
  let watchlist: Awaited<ReturnType<typeof getServerMyWatchlist>> = [];
  let bidRows: Awaited<ReturnType<typeof getServerMyBids>> = [];

  let portfolioError: string | null = null;
  let watchlistError: string | null = null;
  let bidsError: string | null = null;
  let activeError: string | null = null;

  try {
    active = await reader.list({ status: "active", limit: 8, sort: "endingAsc" });
  } catch (e) {
    active = [];
    activeError = e instanceof Error ? e.message : "Could not load live inventory.";
  }

  try {
    portfolio = await getServerMyPortfolio();
  } catch (e) {
    portfolio = [];
    portfolioError = e instanceof Error ? e.message : "Could not load portfolio.";
  }

  try {
    watchlist = await getServerMyWatchlist();
  } catch (e) {
    watchlist = [];
    watchlistError = e instanceof Error ? e.message : "Could not load watchlist.";
  }

  try {
    bidRows = await getServerMyBids();
  } catch (e) {
    bidRows = [];
    bidsError = e instanceof Error ? e.message : "Could not load bids.";
  }

  const firstName = user?.name?.split(/\s+/)[0] ?? "curator";
  const totalSpent = portfolio.reduce(
    (sum, row) => sum + Number.parseFloat(row.lot.currentPrice),
    0,
  );

  const yearUtc = new Date().getUTCFullYear();
  const wonThisYear = portfolio.filter(
    (row) => row.lot.endTime.getUTCFullYear() === yearUtc,
  ).length;

  let wins = 0;
  let losses = 0;
  if (user) {
    const seen = new Set<string>();
    for (const row of bidRows) {
      const a = row.lot;
      if (!a || a.status !== "ended" || seen.has(a.id)) continue;
      seen.add(a.id);
      if (a.winnerId === user.id) wins += 1;
      else losses += 1;
    }
  }
  const decided = wins + losses;
  const winRate = decided > 0 ? Math.round((wins / decided) * 100) : null;

  const wonLotsSidebar = portfolio.filter((row) => row.lot.status === "ended").slice(0, 4);
  const watchPreview = watchlist.filter((w) => w.lot).slice(0, 4);

  const engagementLabel =
    decided > 0 ? `${wins} win${wins === 1 ? "" : "s"} / ${decided} decided` : "—";

  return (
    <div className="max-w-[1920px]">
      {(activeError || portfolioError || watchlistError || bidsError) && (
        <Alert variant="destructive" className="mb-8 border-error/40">
          <AlertTitle>Some data could not load</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {activeError ? <li>Live inventory: {activeError}</li> : null}
              {portfolioError ? <li>Portfolio: {portfolioError}</li> : null}
              {watchlistError ? <li>Watchlist: {watchlistError}</li> : null}
              {bidsError ? <li>Bids: {bidsError}</li> : null}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <PageHeader
        title={`Welcome back, ${firstName}.`}
        description={`${active.length} live lots · ${portfolio.length} acquired work${portfolio.length === 1 ? "" : "s"}`}
        className="mb-10 border-0 pb-0"
        actions={
          <Button variant="secondary" asChild>
            <Link href="/dashboard/submissions/new">New submission</Link>
          </Button>
        }
      />

      <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Portfolio value (hammer)</CardDescription>
            <CardTitle className="font-headline text-3xl text-primary">
              {formatMoney(totalSpent.toFixed(2))}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Won this year (UTC)</CardDescription>
            <CardTitle className="font-headline text-3xl">{wonThisYear}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Win rate</CardDescription>
            <CardTitle className="font-headline text-3xl">
              {winRate !== null ? `${winRate}%` : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Engagement</CardDescription>
            <CardTitle className="font-headline text-3xl">{engagementLabel}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="mb-12 border-primary/25 bg-primary-container/10">
        <CardHeader>
          <CardTitle className="font-headline text-xl">
            Sell with LAX London Auction House Ltd
          </CardTitle>
          <CardDescription className="max-w-2xl text-on-surface-variant">
            Submit item details for specialist review. When approved, we create a draft catalog lot
            for scheduling and publication.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="primary" asChild>
            <Link href="/dashboard/submissions/new">Start a submission</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="font-headline text-2xl">Live inventory</h2>
            <span className="border-b border-primary-container pb-1 font-label text-xs uppercase tracking-widest text-primary">
              Ending soon first
            </span>
          </div>
          <div className="space-y-12">
            {active.length === 0 ? (
              <p className="text-secondary">
                {activeError ? "Live inventory unavailable." : "No active auctions right now."}
              </p>
            ) : (
              active.map((a) => {
                const img = a.images[0];
                return (
                  <Link
                    key={a.id}
                    href={`/artwork/${a.id}`}
                    className="flex flex-col gap-6 border-b border-outline-variant/10 pb-12 transition-opacity last:border-0 hover:opacity-90 md:flex-row md:items-center"
                  >
                    <div className="relative h-32 w-full flex-shrink-0 overflow-hidden rounded-lg bg-surface-container-low md:w-48">
                      {img ? (
                        <Image
                          src={img}
                          alt={`${a.title} — artwork preview`}
                          fill
                          className="object-cover"
                          sizes="192px"
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col justify-center space-y-2">
                      <span className="font-label text-[0.65rem] uppercase tracking-[0.4em] text-secondary">
                        Lot
                      </span>
                      <h3 className="font-headline text-3xl font-light text-on-surface">
                        {a.title}
                      </h3>
                      <p className="font-label text-xs uppercase tracking-widest text-primary">
                        Current {formatMoney(a.currentPrice)}
                      </p>
                    </div>
                    <div className="text-right font-headline text-2xl text-on-surface">
                      {formatMoney(a.currentPrice)}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
        <div className="space-y-8 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline text-xl">Won lots</CardTitle>
            </CardHeader>
            <CardContent>
              {wonLotsSidebar.length === 0 ? (
                <p className="font-body text-sm text-on-surface-variant">No completed wins yet.</p>
              ) : (
                <ul className="space-y-4">
                  {wonLotsSidebar.map((row) => {
                    const a = row.lot;
                    const img = a.images[0];
                    const label = portfolioSettlementLabel(row);
                    return (
                      <li key={a.id}>
                        <Link
                          href={`/dashboard/checkout/${a.id}`}
                          className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-surface-container-high/80"
                        >
                          <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-md bg-surface-container-high">
                            {img ? (
                              <Image
                                src={img}
                                alt={`${a.title} — thumbnail`}
                                fill
                                className="object-cover"
                                sizes="56px"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-headline text-sm text-on-surface">
                              {a.title}
                            </p>
                            <p className="font-label text-xs font-bold uppercase tracking-wider text-primary">
                              {label}
                            </p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-headline text-xl">Watchlist</CardTitle>
            </CardHeader>
            <CardContent>
              {watchPreview.length === 0 ? (
                <p className="font-body text-sm text-on-surface-variant">
                  Save lots from the artwork page to track them here.
                </p>
              ) : (
                <ul className="space-y-4">
                  {watchPreview.map((w) => {
                    const a = w.lot;
                    if (!a) return null;
                    const img = a.images[0];
                    return (
                      <li key={w.watchlistId}>
                        <Link
                          href={`/artwork/${a.id}`}
                          className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-surface-container-high/80"
                        >
                          <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-md bg-surface-container-high">
                            {img ? (
                              <Image
                                src={img}
                                alt={`${a.title} — thumbnail`}
                                fill
                                className="object-cover"
                                sizes="56px"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-headline text-sm text-on-surface">
                              {a.title}
                            </p>
                            <p className="font-label text-xs uppercase tracking-wider text-secondary">
                              Est. {formatMoney(a.currentPrice)}
                            </p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-headline text-xl">Account</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-body text-sm text-secondary">
                <span className="font-medium text-on-surface">Role:</span> {user?.role ?? "—"}
              </p>
              <p className="mt-4 font-body text-xs text-on-surface-variant">
                Manage bids under Active Bids; won lots settle from Portfolio.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function DashboardHomePage() {
  return (
    <Suspense fallback={<DashboardHomeFallback />}>
      <DashboardHomeContent />
    </Suspense>
  );
}
