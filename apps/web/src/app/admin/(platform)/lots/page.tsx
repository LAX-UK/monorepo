import { LotsStaffList } from "@/components/admin/lots/lots-staff-list";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { categoryPickerOptions } from "@/lib/admin/catalog/category-picker-options";
import { loadAdminLotsListPage } from "@/lib/admin/lots/load-lots-list-page";
import {
  lotsAttention,
  lotsFilterChips,
  lotsListHref,
  lotsMetrics,
  lotsMetricsPeriod,
  lotsRangeSummary,
  lotsViews,
  toLotsStaffRows,
} from "@/lib/admin/lots/lots-staff-list.vm";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import {
  LOTS_ACCESS,
  SALES_ACCESS,
  WITHDRAWAL_DECISION_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { formatStaffDate } from "@auction/staff-ui";
import { type UserRole, userHasAccessTo } from "@auction/types";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = metadataForPrivate("Lots", "Catalogue and manage auction lots.");

type LotsSearch = Record<string, string | undefined>;

export default async function AdminLotsPage({
  searchParams,
}: { searchParams: Promise<LotsSearch> }) {
  const user = await requireAdminCapability(LOTS_ACCESS, "/admin/lots");
  const role = user.role as UserRole;
  const staffRoles = user.staffRoles;
  const sp = await searchParams;
  if (sp.view === "pipeline") {
    redirect(buildListHref("/admin/lots", sp, { view: "", offset: 0 }));
  }
  const vm = await loadAdminLotsListPage(sp);
  const { model, pageRows, hasNextPage, listPaginationTotal, lotFilterOptions } = vm;
  const { query } = model;
  const rows = toLotsStaffRows(vm.lotTableRows, vm.withdrawalRequestedAt);
  const lotTrends = {
    live: vm.liveTrend,
    ended: vm.lotsEndedTrend,
    added: vm.lotsTrend,
    hammer: vm.hammerTrend,
  };

  return (
    <LotsStaffList
      rows={rows}
      search={sp}
      views={lotsViews(vm.lensesItems)}
      activeLens={model.activeLens}
      attention={lotsAttention(sp, {
        withdrawalsPending: Object.keys(vm.withdrawalRequestedAt).length,
        draftsMissingPhotos: vm.lotsSummary.needsAttentionCount,
      })}
      metrics={lotsMetrics(vm.lotsSummary, lotTrends)}
      metricsPeriod={lotsMetricsPeriod(lotTrends)}
      filterChips={lotsFilterChips(vm.activeFilterChips)}
      filterOptions={{
        sales: lotFilterOptions.sales.map((sale) => ({
          id: sale.id,
          label: sale.title,
          description: [staffStatus("sale", sale.status).label, formatStaffDate(sale.startTime)]
            .filter(Boolean)
            .join(" · "),
        })),
        artists: lotFilterOptions.artists.map((artist) => ({
          id: artist.id,
          label: artist.displayName,
        })),
        categories: categoryPickerOptions(lotFilterOptions.categories),
      }}
      pageSize={query.limit}
      pagination={
        pageRows.length > 0 && !model.withdrawalsLens
          ? {
              summary: lotsRangeSummary(query.offset, pageRows.length, listPaginationTotal),
              prevHref:
                query.offset > 0
                  ? lotsListHref(sp, { offset: Math.max(0, query.offset - query.limit) })
                  : null,
              nextHref: hasNextPage
                ? lotsListHref(sp, { offset: query.offset + query.limit })
                : null,
            }
          : null
      }
      canManageCatalog={userHasAccessTo(role, staffRoles, LOTS_ACCESS)}
      canManageAuction={userHasAccessTo(role, staffRoles, SALES_ACCESS)}
      canDecideWithdrawals={userHasAccessTo(role, staffRoles, WITHDRAWAL_DECISION_ACCESS)}
      exportFilters={model.exportFilters}
      listError={vm.listError}
      filtered={model.hasListFilters && model.activeLens !== "withdrawals"}
    />
  );
}
