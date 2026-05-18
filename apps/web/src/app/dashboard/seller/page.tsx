import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardEmptyState, DashboardErrorAlert } from "@/components/dashboard/primitives";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { KpiRow } from "@/components/dashboard/primitives/kpi-row";
import { Button } from "@/components/ui/button";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { formatMoney } from "@/lib/format-currency";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import type { ItemSubmission, ItemSubmissionStatus, Lot } from "@auction/types";
import { Surface } from "@auction/ui/components/surface";
import { ArrowRight, CalendarDays, FileStack, Layers, Sparkles, WalletCards } from "lucide-react";
import Link from "next/link";

function countByStatus(rows: { status: ItemSubmissionStatus }[], status: ItemSubmissionStatus) {
  return rows.filter((r) => r.status === status).length;
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

type UpcomingSaleRow = {
  saleId: string;
  saleTitle: string;
  /** ISO of earliest end time among the seller's lots in this sale (used as the schedule anchor). */
  scheduleIso: string;
  scheduleLabel: string;
  lotsInSale: number;
};

type PayoutForecast = {
  /** Sum of reserve prices for active/scheduled lots that have a reserve set. */
  reservedFloor: string;
  /** Sum of current prices for lots above reserve (best-case if hammer holds now). */
  bestCaseHammer: string;
  lotsWithReserve: number;
  liveLots: number;
};

function safeNumber(value: string | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function buildUpcomingSales(
  lots: Lot[],
  saleLookup: Map<string, { id: string; title: string }>,
): UpcomingSaleRow[] {
  const now = Date.now();
  const grouped = new Map<string, { earliest: number; count: number }>();
  for (const lot of lots) {
    if (!lot.saleId) continue;
    if (lot.status !== "active" && lot.status !== "scheduled") continue;
    const endMs = lot.endTime.getTime();
    if (!Number.isFinite(endMs) || endMs < now) continue;
    const existing = grouped.get(lot.saleId);
    if (existing) {
      existing.count += 1;
      if (endMs < existing.earliest) existing.earliest = endMs;
    } else {
      grouped.set(lot.saleId, { earliest: endMs, count: 1 });
    }
  }
  return Array.from(grouped.entries())
    .map(([saleId, info]) => {
      const summary = saleLookup.get(saleId);
      return {
        saleId,
        saleTitle: summary?.title ?? "Untitled sale",
        scheduleIso: new Date(info.earliest).toISOString(),
        scheduleLabel: DATE_FMT.format(new Date(info.earliest)),
        lotsInSale: info.count,
      } satisfies UpcomingSaleRow;
    })
    .sort((a, b) => Date.parse(a.scheduleIso) - Date.parse(b.scheduleIso))
    .slice(0, 3);
}

function buildPayoutForecast(lots: Lot[]): PayoutForecast {
  let reservedFloor = 0;
  let bestCaseHammer = 0;
  let lotsWithReserve = 0;
  let liveLots = 0;
  for (const lot of lots) {
    if (lot.status !== "active" && lot.status !== "scheduled") continue;
    liveLots += 1;
    const reserve = safeNumber(lot.reservePrice);
    const current = safeNumber(lot.currentPrice);
    if (reserve > 0) {
      lotsWithReserve += 1;
      reservedFloor += reserve;
      bestCaseHammer += Math.max(current, reserve);
    } else {
      bestCaseHammer += current;
    }
  }
  return {
    reservedFloor: reservedFloor.toFixed(2),
    bestCaseHammer: bestCaseHammer.toFixed(2),
    lotsWithReserve,
    liveLots,
  };
}

export default async function SellerOverviewPage() {
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: "/dashboard/seller" });
  const { acting } = await resolveActingContext(user.role, user.staffRole ?? null);

  const c = await getServerDataContainer();
  let rows: ItemSubmission[] = [];
  let err: string | null = null;
  let sellerLots: Lot[] = [];
  const [subRes, lotsRes] = await Promise.allSettled([
    c.submissions.listMine({ limit: 100, offset: 0 }),
    acting ? c.sellerLots.list({ sellerId: acting.id, limit: 100 }) : Promise.resolve([] as Lot[]),
  ]);
  if (subRes.status === "fulfilled") {
    rows = subRes.value;
  } else {
    err = subRes.reason instanceof Error ? subRes.reason.message : "Could not load submissions.";
  }
  if (lotsRes.status === "fulfilled") {
    sellerLots = lotsRes.value;
  }

  const upcomingSaleIds = Array.from(
    new Set(
      sellerLots
        .filter((lot) => lot.status === "active" || lot.status === "scheduled")
        .map((lot) => lot.saleId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const saleLookup = new Map<string, { id: string; title: string }>();
  if (upcomingSaleIds.length > 0) {
    const results = await Promise.allSettled(upcomingSaleIds.map((id) => c.sales.getWithLots(id)));
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        saleLookup.set(result.value.sale.id, {
          id: result.value.sale.id,
          title: result.value.sale.title,
        });
      }
    }
  }
  const upcomingSales = buildUpcomingSales(sellerLots, saleLookup);
  const forecast = buildPayoutForecast(sellerLots);

  const drafts = countByStatus(rows, "draft");
  const inReview =
    countByStatus(rows, "submitted") +
    countByStatus(rows, "under_review") +
    countByStatus(rows, "approved");
  const inSale = countByStatus(rows, "converted");
  const closed = countByStatus(rows, "rejected") + countByStatus(rows, "withdrawn");

  const cards = [
    {
      title: "Drafts",
      value: drafts,
      href: "/dashboard/submissions?status=draft",
      hint: "Finish and submit for review",
    },
    {
      title: "In specialist review",
      value: inReview,
      href: "/dashboard/submissions",
      hint: "Submitted, approved pipeline",
    },
    {
      title: "Live or catalogued",
      value: inSale,
      href: "/dashboard/seller/in-sale",
      hint: "Converted to lots",
    },
    {
      title: "Closed outcomes",
      value: closed,
      href: "/dashboard/submissions",
      hint: "Rejected or withdrawn",
    },
  ];

  return (
    <DashboardPage className="space-y-8">
      <DashboardPageHeader
        meta="Selling"
        title="Seller workspace"
        description="Track consignments from first submission through cataloguing, sale, and settlement."
      />

      {err ? <DashboardErrorAlert title="Could not load submissions" message={err} /> : null}

      {!err && rows.length === 0 ? (
        <DashboardEmptyState
          title="Start your first submission"
          description="Tell our specialists about an artwork or collectible. When approved, we draft the catalogue lot for you."
          action={
            <Button variant="primary" asChild>
              <Link href="/dashboard/submissions/new">
                New submission <ArrowRight className="ml-2 inline size-4" aria-hidden />
              </Link>
            </Button>
          }
        />
      ) : null}

      {!err && rows.length > 0 ? (
        <KpiRow
          track="selling"
          columns={4}
          tiles={cards.map((card) => ({
            id: card.title,
            label: card.title,
            value: String(card.value),
            delta: card.hint,
            semanticTone: card.value > 0 ? "emphasis" : "default",
            trendSlot: (
              <Link href={card.href} className="text-xs font-semibold text-primary hover:underline">
                View
              </Link>
            ),
          }))}
        />
      ) : null}

      {!err && (upcomingSales.length > 0 || forecast.liveLots > 0) ? (
        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Surface variant="quiet" padding="md" className="space-y-4">
            <header className="flex items-center gap-3">
              <CalendarDays className="size-5 text-primary" aria-hidden />
              <h2 className="font-headline text-lg font-semibold text-on-surface">
                Upcoming sales
              </h2>
            </header>
            {upcomingSales.length === 0 ? (
              <p className="font-body text-sm text-on-surface-variant">
                No live or scheduled lots yet — once specialists assign your work to a sale, it will
                appear here.
              </p>
            ) : (
              <ul className="divide-y divide-border-hairline">
                {upcomingSales.map((row) => (
                  <li key={row.saleId} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link
                        href="/dashboard/seller/in-sale"
                        className="block truncate font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {row.saleTitle}
                      </Link>
                      <p className="text-xs text-on-surface-variant">
                        {row.lotsInSale} of your lot
                        {row.lotsInSale === 1 ? "" : "s"} · first close{" "}
                        <time dateTime={row.scheduleIso}>{row.scheduleLabel}</time>
                      </p>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
                  </li>
                ))}
              </ul>
            )}
          </Surface>
          <Surface variant="quiet" padding="md" className="space-y-4">
            <header className="flex items-center gap-3">
              <WalletCards className="size-5 text-primary" aria-hidden />
              <h2 className="font-headline text-lg font-semibold text-on-surface">
                Payout forecast
              </h2>
            </header>
            {forecast.liveLots === 0 ? (
              <p className="font-body text-sm text-on-surface-variant">
                No live lots right now. The forecast updates once your submissions are scheduled
                into a sale.
              </p>
            ) : (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                    Reserved floor
                  </dt>
                  <dd className="mt-1 font-headline text-xl tabular-nums text-primary">
                    {formatMoney(forecast.reservedFloor)}
                  </dd>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Hammer floor if every reserved lot just meets reserve.
                  </p>
                </div>
                <div>
                  <dt className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                    Current best case
                  </dt>
                  <dd className="mt-1 font-headline text-xl tabular-nums text-primary">
                    {formatMoney(forecast.bestCaseHammer)}
                  </dd>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Sum of current prices across {forecast.liveLots} live/scheduled lot
                    {forecast.liveLots === 1 ? "" : "s"} · {forecast.lotsWithReserve} reserved.
                  </p>
                </div>
              </dl>
            )}
            <p className="font-body text-xs text-on-surface-variant">
              Indicative only. Final payouts subtract platform fees, VAT, and Stripe transfer
              charges — see{" "}
              <Link
                href="/dashboard/seller/payouts"
                className="underline underline-offset-2 hover:text-on-surface"
              >
                Sold &amp; payouts
              </Link>
              .
            </p>
          </Surface>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <Surface variant="quiet" padding="md" className="flex gap-4">
          <FileStack className="size-10 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              Submissions
            </p>
            <p className="mt-2 font-body text-sm text-on-surface-variant">
              Upload imagery, provenance, and pricing expectations. Specialists reply in the review
              queue.
            </p>
            <Link
              href="/dashboard/submissions"
              className="mt-3 inline-flex font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary underline-offset-4 hover:underline"
            >
              Open submissions
            </Link>
          </div>
        </Surface>
        <Surface variant="quiet" padding="md" className="flex gap-4">
          <Layers className="size-10 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              Items in sale
            </p>
            <p className="mt-2 font-body text-sm text-on-surface-variant">
              Once converted, monitor catalogue status and public links without exposing bidder
              identities.
            </p>
            <Link
              href="/dashboard/seller/in-sale"
              className="mt-3 inline-flex font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary underline-offset-4 hover:underline"
            >
              View items
            </Link>
          </div>
        </Surface>
        <Surface variant="quiet" padding="md" className="flex gap-4">
          <WalletCards className="size-10 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              Payouts
            </p>
            <p className="mt-2 font-body text-sm text-on-surface-variant">
              Hammer, fees, and adjustments consolidate here as finance operations completes wiring.
            </p>
            <Link
              href="/dashboard/seller/payouts"
              className="mt-3 inline-flex font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary underline-offset-4 hover:underline"
            >
              View payouts
            </Link>
          </div>
        </Surface>
      </section>

      <Surface
        variant="section"
        padding="lg"
        className="flex flex-wrap items-center gap-4 border-dashed border-primary/25 bg-primary-container/5"
      >
        <Sparkles className="size-8 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
            Artist profile
          </p>
          <p className="mt-1 font-body text-sm text-on-surface-variant">
            Opt in to manage portrait, biography, and attribution requests routed through admin
            approval.
          </p>
        </div>
        <Button variant="secondary" asChild>
          <Link href="/dashboard/seller/artist">Artist profile (request changes)</Link>
        </Button>
      </Surface>
    </DashboardPage>
  );
}
