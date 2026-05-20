import { AdminCategoriesBoard } from "@/components/admin/admin-categories-board";
import { AdminCategoryCreateSheet } from "@/components/admin/admin-category-create-sheet";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { CatalogCategoriesFilterToolbar } from "@/components/admin/catalog/catalog-categories-filter-toolbar";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { Button } from "@/components/ui/button";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { getAdminCategoryList } from "@/lib/data/http/admin.server";
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
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const includeArchived = (sp.includeArchived ?? "").trim() === "true";
  const q = (sp.q ?? "").trim();
  let categories: Awaited<ReturnType<typeof getAdminCategoryList>> = [];
  let listError: string | null = null;

  try {
    categories = await getAdminCategoryList({ includeArchived });
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
  const activeFilterCount = q ? 1 : 0;

  const errorAlert =
    error || listError ? (
      <AdminListAlert title="Could not load categories">{listError ?? error}</AdminListAlert>
    ) : null;

  const empty =
    !listError && categories.length === 0 ? (
      <AdminEmptyState
        title="No categories yet"
        description="Create categories before cataloguing lots or building sale landing pages."
        action={
          <Button variant="primary" asChild>
            <Link href="/admin/categories?new=1">
              <Plus className="size-4" aria-hidden />
              New category
            </Link>
          </Button>
        }
      />
    ) : null;

  const view =
    !listError && categories.length > 0 ? (
      <AdminCategoriesBoard categories={categories} searchQuery={q} />
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
      </CatalogListShell>
    </>
  );
}
