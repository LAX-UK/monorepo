import { AdminCategoriesBoard } from "@/components/admin/admin-categories-board";
import { AdminCategoryCreateSheet } from "@/components/admin/admin-category-create-sheet";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogBreadcrumbs } from "@/components/admin/catalog/catalog-breadcrumbs";
import { CatalogCategoriesFilterToolbar } from "@/components/admin/catalog/catalog-categories-filter-toolbar";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogPrimaryCta } from "@/components/admin/catalog/catalog-primary-cta";
import { categoriesListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { buildCategoriesActiveFilterChips } from "@/lib/admin/catalog-active-filter-chips";
import { buildCategoriesListKpiTiles } from "@/lib/admin/categories/build-categories-list-kpi-tiles";
import { loadAdminCategoriesListPage } from "@/lib/admin/categories/load-categories-list-page";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Button } from "@auction/ui/components/button";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = metadataForPrivate(
  "Categories",
  "Browse and manage the catalogue taxonomy.",
);

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    includeArchived?: string;
    error?: string;
    limit?: string;
    offset?: string;
    q?: string;
    new?: string;
  }>;
}) {
  const sp = await searchParams;
  const openNewSheet = (sp.new ?? "").trim() === "1";
  const error = safeDecodeAdminErrorParam(sp.error);
  const includeArchived = (sp.includeArchived ?? "").trim() === "true";
  const query = categoriesListController.parseQuery(sp);
  const q = query.q ?? "";

  const {
    rows: categories,
    total,
    summary,
    categoryTree,
    listError,
  } = await loadAdminCategoriesListPage(query);

  const lenses: CatalogSegmentItem[] = [
    {
      id: "active",
      label: "Active",
      href: buildListHref("/admin/categories", sp, { includeArchived: "", offset: 0 }),
    },
    {
      id: "archived",
      label: "Include archived",
      href: buildListHref("/admin/categories", sp, { includeArchived: "true", offset: 0 }),
    },
  ];
  const activeLensId = includeArchived ? "archived" : "active";
  const activeFilterCount = [q, includeArchived ? "includeArchived" : ""].filter(Boolean).length;
  const hasFilters = Boolean(q || includeArchived);

  const errorAlert =
    error || listError ? (
      <AdminListAlert title="Could not load categories">{listError ?? error}</AdminListAlert>
    ) : null;

  const empty =
    !listError && categories.length === 0 ? (
      <CatalogListEmptyState
        title={hasFilters ? "No matching categories" : "No categories yet"}
        description={
          hasFilters
            ? "Try another search term or switch the archive lens."
            : "Create categories before cataloguing lots or building sale landing pages."
        }
        action={
          hasFilters ? (
            <Button variant="secondary" asChild>
              <Link href="/admin/categories">Clear filters</Link>
            </Button>
          ) : (
            <CatalogPrimaryCta href="/admin/categories?new=1" icon={Plus}>
              New category
            </CatalogPrimaryCta>
          )
        }
      />
    ) : null;

  const activeFilterChips = buildCategoriesActiveFilterChips(sp, { q });

  const boardPagination =
    !listError && total > 0 && (query.offset > 0 || query.offset + categories.length < total)
      ? {
          offset: query.offset,
          limit: query.limit,
          countOnPage: categories.length,
          total,
          prevHref:
            query.offset > 0
              ? buildListHref("/admin/categories", sp, {
                  offset: Math.max(0, query.offset - query.limit),
                })
              : null,
          nextHref:
            query.offset + categories.length < total
              ? buildListHref("/admin/categories", sp, { offset: query.offset + query.limit })
              : null,
        }
      : null;

  const boardFilterControls = {
    searchPlaceholder: "Search categories…",
    sheetTitle: "Category filters",
    activeFilterCount,
    searchInputId: "admin-categories-table-search",
  };

  const view =
    !listError && categories.length > 0 ? (
      <AdminCategoriesBoard
        categories={categories}
        searchQuery={q}
        filterControls={boardFilterControls}
        pagination={boardPagination}
        listTotalCount={total}
      />
    ) : null;

  return (
    <>
      <Suspense fallback={null}>
        {!listError ? (
          <AdminCategoryCreateSheet categories={categoryTree} sheetFromQuery={openNewSheet} />
        ) : null}
      </Suspense>
      <CatalogListShell
        title="Categories"
        description="Manage the taxonomy used by sales, lots, and submissions. Archive used categories instead of deleting them."
        breadcrumbs={
          <CatalogBreadcrumbs
            segments={[{ label: "Admin", href: "/admin" }, { label: "Categories" }]}
          />
        }
        primaryAction={
          <CatalogPrimaryCta href="/admin/categories?new=1" icon={Plus}>
            New category
          </CatalogPrimaryCta>
        }
        empty={empty}
        errorAlert={errorAlert}
        filterBar={
          <CatalogCategoriesFilterToolbar
            lenses={lenses}
            activeLensId={activeLensId}
            activeFilterCount={activeFilterCount}
            activeFilterChips={activeFilterChips}
          />
        }
        mobileSummary={
          !listError && categories.length > 0 ? (
            <CatalogListMobileSummary
              metrics={[
                { id: "page", label: "On page", value: String(categories.length) },
                { id: "total", label: "Total", value: String(total) },
                { id: "active", label: "Active", value: String(summary.activeCount) },
                ...(includeArchived
                  ? [{ id: "lens", label: "Lens", value: "Include archived" }]
                  : []),
              ]}
            />
          ) : null
        }
        kpiStrip={
          !listError ? (
            <AdminTrendKpiBand
              ariaLabel="Categories summary"
              tiles={buildCategoriesListKpiTiles({
                periodDays: 30,
                summary,
              })}
            />
          ) : null
        }
      >
        {view}
      </CatalogListShell>
    </>
  );
}
