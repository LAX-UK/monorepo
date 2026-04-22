import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import { formatCountdownClock } from "@/lib/format-countdown";
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
import { KpiTile } from "@auction/ui/components/kpi-tile";
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

export function DashboardOverviewView({ vm, featureV2 = true }: Props) {
  const now = Date.now();
  const { errors } = vm;
  const hasErrors = !!(
    errors.active ||
    errors.portfolio ||
    errors.watchlist ||
    errors.artistFollow ||
    errors.bids
  );

  return (
    <div className="mx-auto w-full max-w-[var(--container-inner,1376px)]">
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
          <DisplayHeading
            as="h1"
            className="text-4xl font-semibold tracking-tight text-brand-900 dark:text-on-surface"
          >
            Welcome back, {vm.firstName}.
          </DisplayHeading>
          <BodyText className="max-w-xl text-brand-500 dark:text-on-surface-variant">
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

      <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Portfolio value (hammer)"
          value={vm.kpi.portfolioValueFormatted}
          delta="Last 30d · indicative"
          deltaTone="neutral"
          trend={vm.kpi.trend}
          trendTone="primary"
          emphasize
        />
        <KpiTile
          label="Won this year (UTC)"
          value={String(vm.kpi.wonThisYear)}
          trend={vm.kpi.trend}
          trendTone="lot-orange"
        />
        <KpiTile
          label="Win rate"
          value={vm.kpi.winRatePercent !== null ? `${vm.kpi.winRatePercent}%` : "—"}
          trend={vm.kpi.trend}
          trendTone="secondary"
        />
        <KpiTile
          label="Engagement"
          value={vm.kpi.engagementLabel}
          delta={`${vm.kpi.activeBidsCount} active`}
          deltaTone={vm.kpi.activeBidsCount > 0 ? "positive" : "neutral"}
          trend={vm.kpi.trend}
          trendTone="primary"
        />
      </div>

      {featureV2 ? (
        <section className="mb-10 rounded-2xl border border-outline-variant/15 bg-surface-container-low/40 px-6 py-8 dark:bg-surface-container-low/40 md:px-10">
          <div className="mx-auto flex max-w-3xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <DisplayHeading
                as="h2"
                className="text-xl font-semibold text-brand-900 dark:text-on-surface"
              >
                Account health
              </DisplayHeading>
              <BodyText className="mt-1 text-sm text-brand-500 dark:text-on-surface-variant">
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

      <section className="mb-14 rounded-2xl border border-primary/20 bg-hero-cream/80 px-6 py-10 dark:bg-surface-container-low/60 dark:border-outline-variant/20 md:px-10">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 text-center md:text-left">
          <DisplayHeading
            as="h2"
            className="text-2xl font-semibold text-brand-900 dark:text-on-surface"
          >
            Sell with LAX London Auction House Ltd
          </DisplayHeading>
          <BodyText className="text-brand-500 dark:text-on-surface-variant">
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
              <DisplayHeading
                as="h2"
                className="text-3xl font-semibold text-brand-900 dark:text-on-surface"
              >
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
                const ms = a.endTime.getTime() - now;
                const clock = formatCountdownClock(ms);
                const hint = vm.activeLotBidHints[a.id] ?? "none";
                return (
                  <article key={a.id} className="flex flex-col gap-4">
                    <Link href={`/artwork/${a.id}`} className="group block">
                      <div className="relative aspect-[320/340] w-full overflow-hidden rounded-lg bg-brand-800 dark:bg-surface-container-high">
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
                        ) : null}
                        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
                          {hint !== "none" ? bidHintBadge(hint) : null}
                          <span className="rounded-sm bg-black/55 px-2 py-1 font-mono text-xs text-white backdrop-blur-sm">
                            {clock}
                          </span>
                        </div>
                      </div>
                    </Link>
                    <div className="flex flex-col gap-2">
                      <p className="font-label text-sm font-bold uppercase leading-4 text-lot-orange">
                        Lot
                      </p>
                      <Link
                        href={`/artwork/${a.id}`}
                        className="font-headline text-xl font-semibold leading-6 text-brand-900 hover:underline dark:text-on-surface"
                      >
                        {a.title}
                      </Link>
                      {a.medium ? (
                        <BodyText className="text-sm font-light text-brand-500 dark:text-on-surface-variant">
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
            <Card className="border-lot-orange/30">
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
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-surface-container-high">
                            {img ? (
                              <Image src={img} alt="" fill className="object-cover" sizes="48px" />
                            ) : null}
                          </div>
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

          <Card>
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
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-surface-container-high">
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="font-headline text-xl">Watchlist</CardTitle>
              <Button variant="chevron" asChild>
                <Link href="/" className="inline-flex items-center gap-1 text-xs">
                  Gallery
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {vm.watchPreview.length === 0 ? (
                <p className="font-body text-sm text-on-surface-variant">
                  Save lots from the artwork page to track them here.
                </p>
              ) : (
                <ul className="space-y-4">
                  {vm.watchPreview.map((w) => {
                    const a = w.lot;
                    if (!a) return null;
                    const img = a.images[0];
                    return (
                      <li key={w.watchlistId}>
                        <Link
                          href={`/artwork/${a.id}`}
                          className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-surface-container-high/80"
                        >
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-surface-container-high">
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
