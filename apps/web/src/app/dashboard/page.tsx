import { ActiveBidsWidget } from "@/components/dashboard/active-bids-widget";
import { getServerAuctionReader } from "@/lib/data/http/auctions.server";
import {
  getServerMyBids,
  getServerMyPortfolio,
  getServerMyWatchlist,
} from "@/lib/data/http/dashboard.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { formatMoney } from "@/lib/format-currency";
import { portfolioSettlementLabel } from "@/lib/portfolio-settlement";
import type { Auction } from "@auction/types";
import Image from "next/image";
import Link from "next/link";

export default async function DashboardHomePage() {
  const user = await getServerSessionUser();
  const reader = await getServerAuctionReader();

  let active: Auction[] = [];
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
    (sum, row) => sum + Number.parseFloat(row.auction.currentPrice),
    0,
  );

  const yearUtc = new Date().getUTCFullYear();
  const wonThisYear = portfolio.filter(
    (row) => row.auction.endTime.getUTCFullYear() === yearUtc,
  ).length;

  let wins = 0;
  let losses = 0;
  if (user) {
    const seen = new Set<string>();
    for (const row of bidRows) {
      const a = row.auction;
      if (!a || a.status !== "ended" || seen.has(a.id)) continue;
      seen.add(a.id);
      if (a.winnerId === user.id) wins += 1;
      else losses += 1;
    }
  }
  const decided = wins + losses;
  const winRate = decided > 0 ? Math.round((wins / decided) * 100) : null;

  const wonLotsSidebar = portfolio.filter((row) => row.auction.status === "ended").slice(0, 4);
  const watchPreview = watchlist.filter((w) => w.auction).slice(0, 4);

  const engagementLabel =
    decided > 0 ? `${wins} win${wins === 1 ? "" : "s"} / ${decided} decided` : "—";

  const activeBidRows = bidRows
    .filter((row) => row.auction?.status === "active")
    .map((row) =>
      row.auction
        ? {
            bid: row.bid,
            auction: row.auction,
          }
        : null,
    )
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="max-w-[1920px]">
      {(activeError || portfolioError || watchlistError || bidsError) && (
        <div
          className="mb-8 rounded-lg border border-error/30 bg-error/10 px-4 py-3 font-body text-sm text-error"
          role="alert"
        >
          <p className="font-label text-xs font-bold uppercase tracking-widest text-error">
            Some data could not load
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {activeError ? <li>Live inventory: {activeError}</li> : null}
            {portfolioError ? <li>Portfolio: {portfolioError}</li> : null}
            {watchlistError ? <li>Watchlist: {watchlistError}</li> : null}
            {bidsError ? <li>Bids: {bidsError}</li> : null}
          </ul>
        </div>
      )}

      {user && activeBidRows.length > 0 ? (
        <ActiveBidsWidget rows={activeBidRows} userId={user.id} />
      ) : null}

      <section className="mb-12">
        <h1 className="mb-4 font-headline text-5xl tracking-tight text-on-surface md:text-6xl">
          Welcome back, {firstName}.
        </h1>
        <p className="font-label text-sm uppercase tracking-[0.2em] text-secondary">
          {active.length} live lots • {portfolio.length} acquired work
          {portfolio.length === 1 ? "" : "s"}
        </p>
      </section>

      <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-surface-container-low p-6 shadow-sm ring-1 ring-outline-variant/10">
          <p className="mb-2 font-label text-xs uppercase tracking-widest text-secondary">
            Portfolio value (hammer)
          </p>
          <p className="font-headline text-3xl text-primary">
            {formatMoney(totalSpent.toFixed(2))}
          </p>
        </div>
        <div className="rounded-xl bg-surface-container-low p-6 shadow-sm ring-1 ring-outline-variant/10">
          <p className="mb-2 font-label text-xs uppercase tracking-widest text-secondary">
            Won this year (UTC)
          </p>
          <p className="font-headline text-3xl text-on-surface">{wonThisYear}</p>
        </div>
        <div className="rounded-xl bg-surface-container-low p-6 shadow-sm ring-1 ring-outline-variant/10">
          <p className="mb-2 font-label text-xs uppercase tracking-widest text-secondary">
            Win rate
          </p>
          <p className="font-headline text-3xl text-on-surface">
            {winRate !== null ? `${winRate}%` : "—"}
          </p>
        </div>
        <div className="rounded-xl bg-surface-container-low p-6 shadow-sm ring-1 ring-outline-variant/10">
          <p className="mb-2 font-label text-xs uppercase tracking-widest text-secondary">
            Engagement
          </p>
          <p className="font-headline text-3xl text-on-surface">{engagementLabel}</p>
        </div>
      </div>

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
                        <Image src={img} alt="" fill className="object-cover" sizes="192px" />
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
          <div className="rounded-xl bg-surface-container-low p-8 shadow-sm ring-1 ring-outline-variant/10">
            <h3 className="mb-4 font-headline text-xl">Won lots</h3>
            {wonLotsSidebar.length === 0 ? (
              <p className="font-body text-sm text-on-surface-variant">No completed wins yet.</p>
            ) : (
              <ul className="space-y-4">
                {wonLotsSidebar.map((row) => {
                  const a = row.auction;
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
                            <Image src={img} alt="" fill className="object-cover" sizes="56px" />
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
          </div>

          <div className="rounded-xl bg-surface-container-low p-8 shadow-sm ring-1 ring-outline-variant/10">
            <h3 className="mb-4 font-headline text-xl">Watchlist</h3>
            {watchPreview.length === 0 ? (
              <p className="font-body text-sm text-on-surface-variant">
                Save lots from the artwork page to track them here.
              </p>
            ) : (
              <ul className="space-y-4">
                {watchPreview.map((w) => {
                  const a = w.auction;
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
                            <Image src={img} alt="" fill className="object-cover" sizes="56px" />
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
          </div>

          <div className="rounded-xl bg-surface-container-low p-8 shadow-sm ring-1 ring-outline-variant/10">
            <h3 className="mb-4 font-headline text-xl">Account</h3>
            <p className="font-body text-sm text-secondary">
              <span className="font-medium text-on-surface">Role:</span> {user?.role ?? "—"}
            </p>
            <p className="mt-4 font-body text-xs text-on-surface-variant">
              Manage bids under Active Bids; won lots settle from Portfolio.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
