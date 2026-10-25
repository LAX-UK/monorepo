import { CategoriesStaffList } from "@/components/admin/categories/categories-staff-list";
import { categoriesListController } from "@/lib/admin/admin-list-controllers";
import {
  categoriesActiveView,
  categoriesListHref,
  categoriesMetrics,
  categoriesRangeSummary,
  categoriesViews,
  toCategoriesStaffRows,
} from "@/lib/admin/categories/categories-staff-list.vm";
import { loadAdminCategoriesListPage } from "@/lib/admin/categories/load-categories-list-page";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = metadataForPrivate(
  "Categories",
  "Browse and manage the catalogue taxonomy.",
);

type CategoriesSearch = Record<string, string | undefined>;

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<CategoriesSearch>;
}) {
  const sp = await searchParams;
  if ((sp.new ?? "").trim() === "1") {
    redirect("/admin/categories/new");
  }
  const query = categoriesListController.parseQuery(sp);
  const { rows, total, summary, listError } = await loadAdminCategoriesListPage(query);
  const error = listError ?? safeDecodeAdminErrorParam(sp.error);

  return (
    <CategoriesStaffList
      rows={toCategoriesStaffRows(rows)}
      search={sp}
      views={categoriesViews(sp, summary)}
      activeView={categoriesActiveView(Boolean(query.includeArchived))}
      metrics={summary ? categoriesMetrics(summary) : null}
      pageSize={query.limit}
      pagination={
        !listError && rows.length > 0
          ? {
              summary: categoriesRangeSummary(query.offset, rows.length, total),
              prevHref:
                query.offset > 0
                  ? categoriesListHref(sp, { offset: Math.max(0, query.offset - query.limit) })
                  : null,
              nextHref:
                query.offset + rows.length < total
                  ? categoriesListHref(sp, { offset: query.offset + query.limit })
                  : null,
            }
          : null
      }
      listError={error}
      filtered={Boolean(query.q)}
    />
  );
}
