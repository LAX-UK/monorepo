import { SalesStaffList } from "@/components/admin/sales/sales-staff-list";
import { loadAdminSalesListPage } from "@/lib/admin/sales/load-sales-list-page";
import {
  salesAttention,
  salesFilterChips,
  salesListHref,
  salesMetrics,
  salesRangeSummary,
  salesViews,
  toSalesStaffRows,
} from "@/lib/admin/sales/sales-staff-list.vm";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SALES_ACCESS, SALE_CATALOG_READ_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { type UserRole, userHasAccessTo } from "@auction/types";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Sales",
  "Plan, publish, and manage auctions.",
);

type SalesSearch = Record<string, string | undefined>;

export default async function AdminSalesPage({
  searchParams,
}: {
  searchParams: Promise<SalesSearch>;
}) {
  const user = await requireAdminCapability(SALE_CATALOG_READ_ACCESS, "/admin/sales");
  const canManageSales = userHasAccessTo(user.role as UserRole, user.staffRoles, SALES_ACCESS);
  const sp = await searchParams;
  const page = await loadAdminSalesListPage(sp);
  const { model, salesSummary, err, boardRows, lensesItems, listPaginationTotal } = page;
  const { query } = model;
  const hasNextPage = page.boardPagination?.nextHref != null;

  return (
    <SalesStaffList
      rows={toSalesStaffRows(boardRows)}
      search={sp}
      views={salesViews(lensesItems)}
      activeLens={model.activeLensId}
      attention={salesAttention(sp, salesSummary)}
      metrics={salesMetrics(salesSummary)}
      filterChips={salesFilterChips(page.activeFilterChips)}
      pageSize={query.limit}
      pagination={
        boardRows.length > 0
          ? {
              summary: salesRangeSummary(query.offset, boardRows.length, listPaginationTotal),
              prevHref:
                query.offset > 0
                  ? salesListHref(sp, { offset: Math.max(0, query.offset - query.limit) })
                  : null,
              nextHref: hasNextPage
                ? salesListHref(sp, { offset: query.offset + query.limit })
                : null,
            }
          : null
      }
      canManageSales={canManageSales}
      exportFilters={model.exportFilters}
      listError={err}
      filtered={model.hasListFilters}
    />
  );
}
