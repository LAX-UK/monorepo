import { AdminCategoriesBoard } from "@/components/admin/admin-categories-board";
import { AdminCategoryCreateSheet } from "@/components/admin/admin-category-create-sheet";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { CatalogCategoriesFilterToolbar } from "@/components/admin/catalog/catalog-categories-filter-toolbar";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { Button } from "@/components/ui/button";
import { categoriesListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
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
      <AdminEmptyState
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
            <Button variant="primary" asChild>
              <Link href="/admin/categories?new=1">
                <Plus className="size-4" aria-hidden />
                New category
              </Link>
            </Button>
          )
        }
      />
    ) : null;

  const view =
    !listError && categories.length > 0 ? <AdminCategoriesBoard categories={categories} /> : null;

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
          <Button variant="primary" asChild>
            <Link href="/admin/categories?new=1">
              <Plus className="size-4" aria-hidden />
              New category
            </Link>
          </Button>
        }
        errorAlert={errorAlert}
        filterBar={
          <CatalogCategoriesFilterToolbar
            lenses={lenses}
            activeLensId={activeLensId}
            activeFilterCount={activeFilterCount}
          />
        }
      >
        {view}
        {empty}
        {pagination}
      </CatalogListShell>
    </>
  );
}
