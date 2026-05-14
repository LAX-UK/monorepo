import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardEmptyState, DashboardErrorAlert } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { DashboardSalesReader } from "@/lib/data/readers/dashboard-readers";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import type { Lot } from "@auction/types";
import { Card, CardContent } from "@auction/ui/components/card";
import { PageHeader } from "@auction/ui/components/page-header";
import { StatusBadge } from "@auction/ui/components/status-badge";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  type InSaleDisplayRow,
  SELLER_LOT_FILTER_OPTIONS,
  type SellerLotStatusFilter,
  filterInSaleRows,
  inSaleFilterHref,
  parseSellerLotStatusFilter,
  sortInSaleRows,
  toInSaleDisplayRows,
} from "./in-sale.vm";

const PAGE_PATH = "/dashboard/seller/in-sale";

type PageProps = {
  searchParams: Promise<{ status?: string; q?: string }>;
};

function badgeVariant(tone: InSaleDisplayRow["statusTone"]) {
  switch (tone) {
    case "success":
      return "success" as const;
    case "danger":
      return "danger" as const;
    case "info":
      return "info" as const;
    case "neutral":
      return "neutral" as const;
  }
}

function FilterChips({ active }: { active: SellerLotStatusFilter }) {
  return (
    <nav aria-label="Filter lots by status" className="flex flex-wrap gap-2">
      {SELLER_LOT_FILTER_OPTIONS.map((opt) => {
        const isActive = opt.value === active;
        return (
          <Link
            key={opt.value}
            href={inSaleFilterHref(PAGE_PATH, opt.value)}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-4 text-xs font-semibold uppercase tracking-widest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              isActive
                ? "bg-primary text-on-primary"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {opt.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ReserveBadge({ row }: { row: InSaleDisplayRow }) {
  if (row.reserveLabel === "No reserve") {
    return (
      <span className="text-xs text-on-surface-variant" title="No reserve set">
        {row.reserveLabel}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
        row.reserveMet ? "bg-success/10 text-success" : "bg-error/10 text-error"
      }`}
    >
      {row.reserveLabel}
    </span>
  );
}

function InSaleRowCard({ row }: { row: InSaleDisplayRow }) {
  return (
    <li>
      <Card>
        <CardContent className="grid gap-3 p-4 text-sm sm:grid-cols-[auto_1fr_auto_auto_auto] sm:items-center">
          <div className="font-mono text-xs text-on-surface-variant tabular-nums sm:min-w-12">
            {row.lotNumberLabel}
          </div>
          <div className="min-w-0">
            <Link
              href={row.lotHref}
              className="block truncate font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {row.title}
            </Link>
            {row.saleTitle && row.saleHref ? (
              <p className="text-xs text-on-surface-variant">
                In{" "}
                <Link
                  href={row.saleHref}
                  className="underline underline-offset-2 hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {row.saleTitle}
                </Link>
                {" · ends "}
                <time dateTime={row.endTimeIso}>{row.endTimeLabel}</time>
              </p>
            ) : (
              <p className="text-xs text-on-surface-variant">
                Ends <time dateTime={row.endTimeIso}>{row.endTimeLabel}</time>
              </p>
            )}
          </div>
          <div className="text-right text-base font-semibold tabular-nums">
            {row.currentPriceLabel}
          </div>
          <div className="flex items-center justify-end">
            <ReserveBadge row={row} />
          </div>
          <div className="flex items-center justify-end">
            <StatusBadge variant={badgeVariant(row.statusTone)} size="sm">
              {row.statusLabel}
            </StatusBadge>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

async function loadSaleLookup(
  saleIds: string[],
  sales: DashboardSalesReader,
): Promise<Map<string, { id: string; title: string }>> {
  const map = new Map<string, { id: string; title: string }>();
  if (saleIds.length === 0) return map;
  const results = await Promise.all(saleIds.map((id) => sales.getWithLots(id)));
  for (const result of results) {
    if (result) map.set(result.sale.id, { id: result.sale.id, title: result.sale.title });
  }
  return map;
}

export default async function SellerInSalePage({ searchParams }: PageProps) {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: PAGE_PATH,
  });
  const { acting } = await resolveActingContext(user.role, user.staffRole ?? null);
  if (!acting) redirect("/dashboard");

  const sp = await searchParams;
  const filter = parseSellerLotStatusFilter(sp.status);
  const rawQ = typeof sp.q === "string" ? sp.q.trim().slice(0, 200) : "";
  const qLower = rawQ.toLowerCase();

  const c = await getServerDataContainer();
  let lots: Lot[] = [];
  let fetchError: string | null = null;
  try {
    lots = await c.sellerLots.list({ sellerId: acting.id, limit: 100 });
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Could not load your lots.";
  }

  const saleIds = Array.from(
    new Set(lots.map((lot) => lot.saleId).filter((id): id is string => Boolean(id))),
  );
  const saleLookup = await loadSaleLookup(saleIds, c.sales).catch(() => new Map());
  const allDisplay = sortInSaleRows(toInSaleDisplayRows(lots, saleLookup));
  const statusFiltered = filterInSaleRows(allDisplay, filter);
  const filtered =
    qLower.length === 0
      ? statusFiltered
      : statusFiltered.filter(
          (row) =>
            row.title.toLowerCase().includes(qLower) ||
            (row.saleTitle?.toLowerCase().includes(qLower) ?? false),
        );

  return (
    <DashboardPage className="screen w-full space-y-6">
      <PageHeader
        title="Items in sale"
        description="Lots from your submissions across every catalogue. Status, reserve, and end time at a glance — bidder identities are never shown."
        className="border-0 pb-0"
      />

      <div className="flex flex-wrap items-center gap-3">
        <FilterChips active={filter} />
        <form
          action={PAGE_PATH}
          method="get"
          aria-label="Filter lots by title"
          className="flex flex-1 items-center gap-2 sm:max-w-sm"
        >
          {filter !== "live" ? <input type="hidden" name="status" value={filter} /> : null}
          <label htmlFor="in-sale-q" className="sr-only">
            Filter by lot or sale title
          </label>
          <input
            id="in-sale-q"
            name="q"
            type="search"
            defaultValue={rawQ}
            placeholder="Search by lot or sale title"
            className="h-10 w-full rounded-md border border-outline-variant/40 bg-surface-container-lowest px-3 font-body text-sm text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
        </form>
      </div>

      {fetchError ? (
        <DashboardErrorAlert
          title="Could not load your lots"
          message={`${fetchError} Refresh the page or try again in a few minutes.`}
        />
      ) : null}

      <section aria-live="polite" aria-busy="false">
        {!fetchError && allDisplay.length === 0 ? (
          <DashboardEmptyState
            title="No lots yet"
            description="Once your submissions are approved and added to a sale, they will appear here. Start by submitting your first work."
            action={
              <Button variant="primary" asChild>
                <Link href="/dashboard/submissions/new">Submit your first work</Link>
              </Button>
            }
          />
        ) : null}

        {!fetchError && allDisplay.length > 0 && filtered.length === 0 ? (
          <DashboardEmptyState
            title={rawQ ? "No lots match this search" : "No lots match this filter"}
            description={
              rawQ
                ? "Try a different keyword or clear the search to see every lot."
                : "Your approved submissions will appear here once we schedule them into a sale."
            }
            action={
              <Button variant="secondary" asChild>
                <Link href={PAGE_PATH}>Show live & scheduled</Link>
              </Button>
            }
          />
        ) : null}

        {filtered.length > 0 ? (
          <ul className="space-y-3">
            {filtered.map((row) => (
              <InSaleRowCard key={row.id} row={row} />
            ))}
          </ul>
        ) : null}
      </section>
    </DashboardPage>
  );
}
