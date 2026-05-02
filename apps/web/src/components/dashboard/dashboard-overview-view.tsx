import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { LotCardTimer } from "@/components/lot-timer";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import { formatMoney } from "@/lib/format-currency";
import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import { portfolioSettlementLabel } from "@/lib/portfolio-settlement";
import { BodyText, DisplayHeading, LabelCaps, LiveDot, SectionHeader } from "@auction/ui";
import { TimelineStages } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
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
import Image from "next/image";
import Link from "next/link";

type Props = {
  vm: DashboardOverviewVm;
  /** When false, hides v2-only blocks (rollback via `NEXT_PUBLIC_DASHBOARD_V2`). */
  featureV2?: boolean;
};

function bidHintBadge(hint: "high" | "outbid" | "none") {
  if (hint === "high") return <StatusBadge variant="success">High bidder</StatusBadge>;
  if (hint === "outbid") return <StatusBadge variant="danger">Outbid</StatusBadge>;
  return null;
}

function settlementTotal(row: DashboardOverviewVm["settlementsDue"][number]) {
  const hammer = Number.parseFloat(row.lot.currentPrice);
  const premiumRate = Number.parseFloat(row.lot.buyerPremiumRate);
  if (!Number.isFinite(hammer)) return row.lot.currentPrice;
  const premium = Number.isFinite(premiumRate) ? hammer * premiumRate : 0;
  return (hammer + premium).toFixed(2);
}

function Thumbnail({
  src,
  alt,
  className,
  sizes,
}: {
  src: string | undefined;
  alt: string;
  className: string;
  sizes: string;
}) {
  return (
    <div className={`relative shrink-0 overflow-hidden bg-surface-container-high ${className}`}>
      {src ? (
        <Image src={src} alt={alt} fill className="object-cover" sizes={sizes} />
      ) : (
        <ImagePlaceholder label="Lot artwork" hideIcon />
      )}
    </div>
  );
}

function ActionRequiredBanner({
  row,
}: {
  row: DashboardOverviewVm["settlementsDue"][number] | undefined;
}) {
  if (!row) return null;

  const total = formatMoney(settlementTotal(row));

  return (
    <section className="mb-10 overflow-hidden rounded-2xl border border-lot-orange/25 bg-lot-orange/10 shadow-sm">
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <Thumbnail src={row.lot.images[0]} alt="" className="size-16 rounded-xl" sizes="64px" />
          <div className="min-w-0">
            <LabelCaps className="text-lot-orange">Action required</LabelCaps>
            <h2 className="mt-1 truncate font-headline text-xl font-semibold text-on-surface">
              You won {row.lot.title}
            </h2>
            <p className="text-sm text-on-surface-variant">
              Total due {total} · {portfolioSettlementLabel(row)}
            </p>
          </div>
        </div>
        <Button className="min-h-11 shrink-0" asChild>
          <Link href={`/dashboard/checkout/${row.lot.id}`}>Complete checkout</Link>
        </Button>
      </div>
    </section>
  );
}

function ActiveBidsList({ vm }: { vm: DashboardOverviewVm }) {
  const activeBidLots = vm.activeLots.filter((lot) => vm.activeLotBidHints[lot.id] !== "none");

  return (
    <Card className="border-outline-variant/15 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="font-headline text-xl">Active bids</CardTitle>
          <CardDescription>Lots where your latest bid is still in play.</CardDescription>
        </div>
        <Button variant="chevron" asChild>
          <Link href="/dashboard/bids" className="inline-flex items-center gap-1 text-xs">
            View bids
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {activeBidLots.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            No active bid positions right now. Browse live lots to place your next bid.
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant/10">
            {activeBidLots.slice(0, 5).map((lot) => {
              const hint = vm.activeLotBidHints[lot.id] ?? "none";
              return (
                <li key={lot.id}>
                  <Link
                    href={`/artwork/${lot.id}`}
                    className="grid gap-3 py-4 transition-colors hover:bg-surface-container-low/45 sm:grid-cols-[1fr_auto] sm:items-center sm:px-2"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Thumbnail
                        src={lot.images[0]}
                        alt={`${lot.title} thumbnail`}
                        className="size-14 rounded-lg"
                        sizes="56px"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-headline text-sm font-semibold text-on-surface">
                          {lot.title}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="font-label text-xs uppercase tracking-wider text-primary">
                            Current {formatMoney(lot.currentPrice)}
                          </span>
                          {bidHintBadge(hint)}
                        </span>
                      </span>
                    </span>
                    <span className="justify-self-start sm:justify-self-end">
                      <LotCardTimer
                        status={lot.status}
                        startTime={lot.startTime.toISOString()}
                        endTime={lot.endTime.toISOString()}
                      />
                    </span>
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

function WatchlistPair({ vm }: { vm: DashboardOverviewVm }) {
  const items = vm.watchPreview.slice(0, 2).filter((row) => row.lot);

  return (
    <Card className="border-outline-variant/15 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="font-headline text-xl">Watchlist</CardTitle>
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
          <p className="text-sm text-on-surface-variant">
            Save lots from artwork pages to build a personal watchlist.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.map((row) => {
              const lot = row.lot;
              if (!lot) return null;
              return (
                <Link
                  key={row.watchlistId}
                  href={`/artwork/${lot.id}`}
                  className="group overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-lowest transition-colors hover:border-primary/25 hover:bg-surface-container-low"
                >
                  <div className="relative aspect-4/3 overflow-hidden bg-surface-container-high">
                    {lot.images[0] ? (
                      <Image
                        src={lot.images[0]}
                        alt={`${lot.title} thumbnail`}
                        fill
                        placeholder="blur"
                        blurDataURL={TINY_IMAGE_BLUR}
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, 240px"
                      />
                    ) : (
                      <ImagePlaceholder label="Lot artwork" />
                    )}
                  </div>
                  <div className="space-y-2 p-3">
                    <p className="line-clamp-2 font-headline text-sm font-semibold text-on-surface">
                      {lot.title}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-label text-xs uppercase tracking-wider text-secondary">
                        Est. {formatMoney(lot.currentPrice)}
                      </span>
                      <StatusBadge variant={lot.status === "active" ? "live" : "neutral"}>
                        {lot.status}
                      </StatusBadge>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardOverviewView({ vm, featureV2 = true }: Props) {
  const { errors } = vm;
  const hasErrors = !!(
    errors.active ||
    errors.portfolio ||
    errors.watchlist ||
    errors.artistFollow ||
    errors.bids
  );

  return (
    <div className="w-full">
      {hasErrors ? (
        <Alert variant="destructive" className="mb-8 border-error/40">
          <AlertTitle>Some data could not load</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {errors.active ? <li>Live inventory: {errors.active}</li> : null}
              {errors.portfolio ? <li>Portfolio: {errors.portfolio}</li> : null}
              {errors.watchlist ? <li>Watchlist: {errors.watchlist}</li> : null}
              {errors.artistFollow ? <li>Followed artists: {errors.artistFollow}</li> : null}
              {errors.bids ? <li>Bids: {errors.bids}</li> : null}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <header className="mb-10 flex flex-col gap-6 border-b border-outline-variant/10 pb-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <LabelCaps className="text-lot-orange">Signed in · Collector</LabelCaps>
          <DisplayHeading as="h1" className="text-4xl font-semibold tracking-tight text-on-surface">
            Welcome back, {vm.firstName}.
          </DisplayHeading>
          <BodyText className="max-w-xl text-on-surface-variant">
            {vm.liveCount} live lots · {vm.acquiredCount} acquired work
            {vm.acquiredCount === 1 ? "" : "s"} · {vm.kpi.activeBidsCount} active bid
            {vm.kpi.activeBidsCount === 1 ? "" : "s"}
          </BodyText>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-low px-4 py-2">
            <LiveDot size="sm" />
            <span className="font-label text-xs font-bold uppercase tracking-widest text-on-surface">
              Live saleroom
            </span>
          </div>
          {featureV2 && vm.primaryCta ? (
            <Button className="min-h-11 w-full sm:w-auto" asChild>
              <Link href={vm.primaryCta.href}>{vm.primaryCta.label}</Link>
            </Button>
          ) : null}
          <Button variant="secondary" className="min-h-11 w-full sm:w-auto" asChild>
            <Link href="/dashboard/submissions/new">New submission</Link>
          </Button>
        </div>
      </header>

      <KpiGrid
        className="mb-8"
        tiles={[
          {
            label: "Active bids",
            value: String(vm.kpi.activeBidsCount),
            delta: vm.kpi.activeBidsCount > 0 ? "Live positions" : "Ready to bid",
            deltaTone: vm.kpi.activeBidsCount > 0 ? "positive" : "neutral",
            trend: vm.kpi.trend,
            trendTone: "primary",
            emphasize: true,
          },
          {
            label: "Won lots",
            value: String(vm.acquiredCount),
            delta: `${vm.kpi.wonThisYear} this year`,
            trend: vm.kpi.trend,
            trendTone: "lot-orange",
          },
          {
            label: "Watchlist",
            value: String(vm.watchPreview.length),
            delta: "Saved lots",
            trend: vm.kpi.trend,
            trendTone: "secondary",
          },
          {
            label: "Submissions",
            value: vm.primaryCta?.href.includes("/submissions") ? "Start" : "Open",
            delta: "Specialist review",
            trend: vm.kpi.trend,
            trendTone: "primary",
          },
        ]}
      />

      <ActionRequiredBanner row={vm.settlementsDue[0]} />

      {featureV2 ? (
        <section className="mb-10 rounded-sm border border-outline-variant/15 bg-surface-container-low/30 px-5 py-6 md:px-8">
          <div className="mx-auto flex max-w-3xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <DisplayHeading as="h2" className="text-xl font-semibold text-on-surface">
                Account health
              </DisplayHeading>
              <BodyText className="mt-1 text-sm text-on-surface-variant">
                Complete profile, alert settings, and payout readiness as you scale bidding.
              </BodyText>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" asChild>
                <Link href="/dashboard/settings/profile">Profile</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/dashboard/settings/notifications">Alerts</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/dashboard/settings/bidding">Bidding</Link>
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <div className="mb-12 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <ActiveBidsList vm={vm} />
        <WatchlistPair vm={vm} />
      </div>

      <section className="mb-14 rounded-2xl border border-outline-variant/15 bg-surface-container-low/25 px-5 py-8 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 text-center md:text-left">
          <DisplayHeading as="h2" className="text-2xl font-semibold text-on-surface">
            Sell with LAX London Auction House Ltd
          </DisplayHeading>
          <BodyText className="text-on-surface-variant">
            Submit item details for specialist review. When approved, we create a draft catalog lot
            for scheduling and publication.
          </BodyText>
          <div>
            <Button asChild>
              <Link href="/dashboard/submissions/new">Start a submission</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-8">
          <SectionHeader
            className="mb-8"
            kicker={
              <span className="inline-flex items-center gap-2 font-label text-xs font-bold uppercase tracking-widest text-lot-orange">
                <LiveDot size="sm" />
                Ending soon first
              </span>
            }
            heading={
              <DisplayHeading as="h2" className="text-3xl font-semibold text-on-surface">
                Live inventory
              </DisplayHeading>
            }
            action={
              <Button variant="chevron" asChild>
                <Link href="/" className="inline-flex items-center gap-2 py-3">
                  Browse gallery
                  <ChevronRight className="size-5 shrink-0" aria-hidden />
                </Link>
              </Button>
            }
          />

          {vm.activeLots.length === 0 ? (
            <p className="text-secondary">
              {errors.active ? "Live inventory unavailable." : "No active auctions right now."}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
              {vm.activeLots.map((a) => {
                const img = a.images[0];
                const hint = vm.activeLotBidHints[a.id] ?? "none";
                return (
                  <article key={a.id} className="flex flex-col gap-4">
                    <Link href={`/artwork/${a.id}`} className="group block">
                      <div className="relative aspect-320/340 w-full overflow-hidden rounded-lg bg-brand-800 dark:bg-surface-container-high">
                        {img ? (
                          <Image
                            src={img}
                            alt={`${a.title} — artwork preview`}
                            fill
                            placeholder="blur"
                            blurDataURL={TINY_IMAGE_BLUR}
                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                          />
                        ) : (
                          <ImagePlaceholder label="Lot artwork" />
                        )}
                        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
                          {hint !== "none" ? bidHintBadge(hint) : null}
                          <LotCardTimer
                            status={a.status}
                            startTime={a.startTime.toISOString()}
                            endTime={a.endTime.toISOString()}
                          />
                        </div>
                      </div>
                    </Link>
                    <div className="flex flex-col gap-2">
                      <p className="font-label text-sm font-bold uppercase leading-4 text-lot-orange">
                        Lot
                      </p>
                      <Link
                        href={`/artwork/${a.id}`}
                        className="font-headline text-xl font-semibold leading-6 text-on-surface hover:underline"
                      >
                        {a.title}
                      </Link>
                      {a.medium ? (
                        <BodyText className="text-sm font-light text-on-surface-variant">
                          {a.medium}
                        </BodyText>
                      ) : null}
                      <div className="flex flex-col gap-1 pt-1">
                        <span className="font-label text-xs uppercase tracking-widest text-primary">
                          Current {formatMoney(a.currentPrice)}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-8 lg:col-span-4">
          {vm.settlementsDue.length > 0 ? (
            <Card className="border border-outline-variant/15 shadow-none border-lot-orange/30">
              <CardHeader>
                <CardTitle className="font-headline text-xl">Settlements due</CardTitle>
                <CardDescription>Won lots awaiting payment or completion.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {vm.settlementsDue.slice(0, 4).map((row) => {
                  const a = row.lot;
                  const img = a.images[0];
                  const label = portfolioSettlementLabel(row);
                  const stageIdx =
                    label === "Paid" || label === "Payment authorized"
                      ? 2
                      : label.includes("Refund")
                        ? 0
                        : 1;
                  return (
                    <div
                      key={a.id}
                      className="flex flex-col gap-3 rounded-lg bg-surface-container-low/60 p-3"
                    >
                      {featureV2 ? (
                        <TimelineStages
                          activeIndex={stageIdx}
                          stages={[
                            { id: "inv", label: "Invoice" },
                            { id: "pay", label: "Paid" },
                            { id: "ship", label: "Shipping" },
                            { id: "done", label: "Delivered" },
                          ]}
                        />
                      ) : (
                        <p className="font-label text-[10px] uppercase tracking-wider text-secondary">
                          {label}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href={`/dashboard/checkout/${a.id}`}
                          className="flex min-w-0 flex-1 items-center gap-3"
                        >
                          <Thumbnail src={img} alt="" className="size-12 rounded-md" sizes="48px" />
                          <div className="min-w-0">
                            <p className="truncate font-headline text-sm">{a.title}</p>
                            <p className="font-label text-[10px] uppercase tracking-wider text-lot-orange">
                              {portfolioSettlementLabel(row)}
                            </p>
                          </div>
                        </Link>
                        <Button
                          className="shrink-0 text-xs uppercase tracking-widest"
                          size="sm"
                          asChild
                        >
                          <Link href={`/dashboard/checkout/${a.id}`}>Pay</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}

          <Card className="border border-outline-variant/15 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="font-headline text-xl">Won lots</CardTitle>
              <Button variant="chevron" asChild>
                <Link
                  href="/dashboard/portfolio"
                  className="inline-flex items-center gap-1 text-xs"
                >
                  Portfolio
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {vm.wonLotsSidebar.length === 0 ? (
                <p className="font-body text-sm text-on-surface-variant">No completed wins yet.</p>
              ) : (
                <ul className="space-y-4">
                  {vm.wonLotsSidebar.map((row) => {
                    const a = row.lot;
                    const img = a.images[0];
                    const label = portfolioSettlementLabel(row);
                    return (
                      <li key={a.id}>
                        <Link
                          href={`/dashboard/checkout/${a.id}`}
                          className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-surface-container-high/80"
                        >
                          <Thumbnail
                            src={img}
                            alt={`${a.title} thumbnail`}
                            className="size-14 rounded-md"
                            sizes="56px"
                          />
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

          <Card className="border border-outline-variant/15 shadow-none">
            <CardHeader>
              <CardTitle className="font-headline text-xl">Account</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-body text-sm text-secondary">
                <span className="font-medium text-on-surface">Role:</span> {vm.userRole ?? "—"}
              </p>
              <p className="mt-4 font-body text-xs text-on-surface-variant">
                Manage bids under Active Bids; won lots settle from Portfolio.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
