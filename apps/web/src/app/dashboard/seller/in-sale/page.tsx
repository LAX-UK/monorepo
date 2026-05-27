import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { FilterRowNav } from "@/components/dashboard/filter-row-nav";
import { DashboardEmptyState } from "@/components/dashboard/primitives";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { DashboardToolbar } from "@/components/dashboard/primitives/dashboard-toolbar";
import { KpiRow } from "@/components/dashboard/primitives/kpi-row";
import {
  SellerOrgContextBanner,
  SellerProfileUnavailableAlert,
} from "@/components/dashboard/seller-org-context-banner";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { DASHBOARD_CTA, DASHBOARD_EMPTY, DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import {
  type DashboardSliceFailure,
  describeDashboardSliceFailure,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { DashboardSalesReader } from "@/lib/data/readers/dashboard-readers";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import type { Lot } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";
import { buildInSaleKpiTiles } from "./in-sale-metrics";
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
    <FilterRowNav
      label="Filter lots by status"
      scroll={false}
      items={SELLER_LOT_FILTER_OPTIONS.map((opt) => ({
        id: opt.value,
        label: opt.label,
        href: inSaleFilterHref(PAGE_PATH, opt.value),
        active: opt.value === active,
      }))}
    />
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
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] ${
        row.reserveMet ? "bg-success/10 text-success" : "bg-error/10 text-error"
      }`}
    >
      {row.reserveLabel}
    </span>
  );
}

function InSaleRowCard({ row }: { row: InSaleDisplayRow }) {
  return (
    <li className="lift-row">
      <Surface variant="card" padding="md">
        <div className="grid gap-3 text-sm sm:grid-cols-[auto_1fr_auto_auto_auto] sm:items-center">
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
        </div>
      </Surface>
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
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRole ?? null);
  const { sellerEntityId, orgActingSelected, bootstrapFailed } = sellerCtx;

  const sp = await searchParams;
  const filter = parseSellerLotStatusFilter(sp.status);
  const rawQ = typeof sp.q === "string" ? sp.q.trim().slice(0, 200) : "";
  const qLower = rawQ.toLowerCase();

  const c = await getServerDataContainer();
  let lots: Lot[] = [];
  let loadFailure: DashboardSliceFailure | null = null;
  if (!sellerEntityId) {
    loadFailure = null;
  } else {
    try {
      lots = await c.sellerLots.list({ sellerId: sellerEntityId, limit: 100 });
    } catch (e) {
      loadFailure = describeDashboardSliceFailure(e, "sellerLots", "Could not load your lots.");
    }
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
      <DashboardPageHeader
        meta="Selling"
        title="Items in sale"
        description="Lots from your submissions across every catalogue. Status, reserve, and end time at a glance — bidder identities are never shown."
      />

      {orgActingSelected ? <SellerOrgContextBanner /> : null}
      {!sellerEntityId ? <SellerProfileUnavailableAlert bootstrapFailed={bootstrapFailed} /> : null}

      {!loadFailure && allDisplay.length > 0 ? (
        <KpiRow track="selling" columns={4} tiles={buildInSaleKpiTiles(allDisplay)} />
      ) : null}

      <DashboardToolbar
        chips={<FilterChips active={filter} />}
        search={
          <form
            action={PAGE_PATH}
            method="get"
            aria-label="Filter lots by title"
            className="flex w-full items-center gap-2"
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
        }
      />

      {loadFailure ? <DashboardSliceErrorAlert failure={loadFailure} /> : null}

      <section aria-live="polite" aria-busy="false">
        {!loadFailure && allDisplay.length === 0 ? (
          <DashboardEmptyState
            title={DASHBOARD_EMPTY.sellerInSale.title}
            description={DASHBOARD_EMPTY.sellerInSale.description}
            action={
              <Button variant="primary" asChild>
                <Link href={DASHBOARD_ROUTES.submissionsNew}>{DASHBOARD_CTA.newSubmission}</Link>
              </Button>
            }
          />
        ) : null}

        {!loadFailure && allDisplay.length > 0 && filtered.length === 0 ? (
          <DashboardEmptyState
            title={rawQ ? "No lots match this search" : "No lots match this filter"}
            description={
              rawQ
                ? "Try a different keyword or clear the search to see every lot."
                : "Your approved submissions will appear here once we schedule them into a sale."
            }
            action={
              <Button variant="secondaryOutline" asChild>
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
