import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { KpiRow } from "@/components/dashboard/primitives/kpi-row";
import {
  SellerOrgContextBanner,
  SellerProfileUnavailableAlert,
} from "@/components/dashboard/seller-org-context-banner";
import { InSaleBoard } from "@/components/dashboard/seller/in-sale-board";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { describeDashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import {
  hasInSaleActiveFilters,
  parseInSaleParams,
} from "@/lib/dashboard/filters/in-sale/in-sale-filters";
import { kpiCompareHint } from "@/lib/dashboard/kpi-slot-conventions";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { DashboardSalesReader } from "@/lib/data/readers/dashboard-readers";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import { readClientWorkspacePageMeta } from "@/lib/workspace/client-workspace-mode";
import type { Lot } from "@auction/types";
import { buildInSaleKpiTiles } from "./in-sale-metrics";
import {
  type InSaleDisplayRow,
  filterInSaleRows,
  sortInSaleRows,
  toInSaleDisplayRows,
} from "./in-sale.vm";

const PAGE_PATH = "/dashboard/seller/in-sale";

type PageProps = {
  searchParams: Promise<{ status?: string; q?: string }>;
};

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
  const filters = parseInSaleParams(sp);
  const rawQ = filters.q;
  const qLower = rawQ.toLowerCase();

  const c = await getServerDataContainer();
  let lots: Lot[] = [];
  let loadFailure: Awaited<ReturnType<typeof describeDashboardSliceFailure>> | null = null;
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
  const statusFiltered = filterInSaleRows(allDisplay, filters.status);
  const filtered: InSaleDisplayRow[] =
    qLower.length === 0
      ? statusFiltered
      : statusFiltered.filter(
          (row) =>
            row.title.toLowerCase().includes(qLower) ||
            (row.saleTitle?.toLowerCase().includes(qLower) ?? false),
        );

  const workspaceMeta = await readClientWorkspacePageMeta();
  const hasActiveFilters = hasInSaleActiveFilters(filters);
  const kpiSource = hasActiveFilters ? filtered : allDisplay;
  const filteredHint = hasActiveFilters ? kpiCompareHint(`${filtered.length} shown`) : {};
  const kpiTiles = buildInSaleKpiTiles(kpiSource).map((tile) => ({
    ...tile,
    ...filteredHint,
  }));

  return (
    <DashboardPage className="screen w-full space-y-6">
      <DashboardPageHeader
        meta={workspaceMeta}
        title="Items in sale"
        hideTitleOnMobile
        hideDescriptionOnMobile
        description="Lots from your submissions across every catalogue. Status, reserve, and end time at a glance — bidder identities are never shown."
      />

      {orgActingSelected ? <SellerOrgContextBanner /> : null}
      {!sellerEntityId ? <SellerProfileUnavailableAlert bootstrapFailed={bootstrapFailed} /> : null}

      {!loadFailure && allDisplay.length > 0 ? (
        <KpiRow track="selling" columns={4} tiles={kpiTiles} />
      ) : null}

      {loadFailure ? <DashboardSliceErrorAlert failure={loadFailure} /> : null}

      {!loadFailure ? (
        <InSaleBoard filters={filters} allDisplay={allDisplay} filtered={filtered} />
      ) : null}
    </DashboardPage>
  );
}
