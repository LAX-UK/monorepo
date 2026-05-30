import { AdminCategoriesBoard } from "@/components/admin/admin-categories-board";
import { AdminCategoryCreateSheet } from "@/components/admin/admin-category-create-sheet";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { CatalogCategoriesFilterToolbar } from "@/components/admin/catalog/catalog-categories-filter-toolbar";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { CatalogPrimaryCta } from "@/components/admin/catalog/catalog-primary-cta";
import { categoriesListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { buildCategoriesActiveFilterChips } from "@/lib/admin/catalog-active-filter-chips";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { Button } from "@auction/ui/components/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

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

  let categories: Awaited<ReturnType<typeof categoriesListController.fetch>>["rows"] = [];
  let total = 0;
  let listError: string | null = null;

  try {
    const result = await categoriesListController.fetch(query);
    categories = result.rows;
    total = result.total ?? categories.length;
  } catch (e) {
    listError = e instanceof Error ? e.message : "Could not load categories.";
  }

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
            <Button variant="secondaryOutline" asChild>
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

  const view =
    !listError && categories.length > 0 ? (
      <AdminCategoriesBoard categories={categories} searchQuery={q} />
    ) : null;

  const pagination =
    !listError && total > 0 && (query.offset > 0 || query.offset + categories.length < total) ? (
      <CatalogPagination
        offset={query.offset}
        limit={query.limit}
        countOnPage={categories.length}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/categories", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          query.offset + categories.length < total
            ? buildListHref("/admin/categories", sp, { offset: query.offset + query.limit })
            : null
        }
      />
    ) : null;

  return (
    <>
      <Suspense fallback={null}>
        {!listError ? (
          <AdminCategoryCreateSheet categories={categories} sheetFromQuery={openNewSheet} />
        ) : null}
      </Suspense>
      <CatalogListShell
        title="Categories"
        description="Manage the taxonomy used by sales, lots, and submissions. Archive used categories instead of deleting them."
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
              segments={[
                `${categories.length} on page`,
                total > 0 ? `${total} total` : null,
                includeArchived ? "Include archived" : null,
              ]}
            />
          ) : null
        }
        kpiStrip={
          !listError && categories.length > 0 ? (
            <AdminListKpiStrip
              ariaLabel="Categories summary"
              tiles={[
                {
                  label: "On this page",
                  value: categories.length,
                  delta: total > 0 ? `${total} total` : undefined,
                },
                {
                  label: "Lens",
                  value: includeArchived ? "Archived" : "Active",
                },
              ]}
            />
          ) : null
        }
        pagination={pagination}
      >
        {view}
      </CatalogListShell>
      {!listError ? (
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] end-4 z-40 lg:hidden">
          <CatalogPrimaryCta href="/admin/categories?new=1" icon={Plus}>
            New category
          </CatalogPrimaryCta>
        </div>
      ) : null}
    </>
  );
}
