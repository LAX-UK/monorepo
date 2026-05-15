import { AdminCategoriesBoard } from "@/components/admin/admin-categories-board";
import { AdminListPage } from "@/components/admin/admin-list-page";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { Button } from "@/components/ui/button";
import { categoriesListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { PaginationFooter } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    includeArchived?: string;
    error?: string;
    limit?: string;
    offset?: string;
  }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const query = categoriesListController.parseQuery(sp);

  let categories: Awaited<ReturnType<typeof categoriesListController.fetch>>["rows"] = [];
  let total = 0;
  let listError: string | null = null;

  try {
    const result = await categoriesListController.fetch(query);
    categories = result.rows;
    total = result.total ?? 0;
  } catch (e) {
    listError = e instanceof Error ? e.message : "Could not load categories.";
  }

  const chips = (
    <FilterChipRow
      label="Category archive scope"
      chips={[
        {
          id: "active",
          label: "Active",
          href: buildListHref("/admin/categories", sp, { includeArchived: "", offset: 0 }),
          active: !query.includeArchived,
        },
        {
          id: "archived",
          label: "Include archived",
          href: buildListHref("/admin/categories", sp, { includeArchived: "true", offset: 0 }),
          active: Boolean(query.includeArchived),
        },
      ]}
    />
  );

  const filters = (
    <p className="max-w-xl font-body text-sm text-on-surface-variant">
      Use the chips to include archived categories. Pagination applies to the flat list window
      before the tree is built.
    </p>
  );

  const errorAlert =
    error || listError ? (
      <Alert variant="destructive">
        <AlertTitle>Could not load categories</AlertTitle>
        <AlertDescription>{listError ?? error}</AlertDescription>
      </Alert>
    ) : null;

  const empty =
    !listError && categories.length === 0 ? (
      <EmptyState
        title="No categories yet"
        description="Create categories before cataloguing lots or building sale landing pages."
        action={
          <Button variant="primary" asChild>
            <Link href="/admin/categories/new">
              <Plus className="size-4" aria-hidden />
              New category
            </Link>
          </Button>
        }
      />
    ) : null;

  const view =
    !listError && categories.length > 0 ? <AdminCategoriesBoard categories={categories} /> : null;

  const pagination =
    !listError && categories.length > 0 ? (
      <PaginationFooter
        offset={query.offset}
        limit={query.limit}
        total={total}
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
    <AdminListPage
      title="Categories"
      description="Manage the taxonomy used by sales, lots, and submissions. Archive used categories instead of deleting them."
      primaryAction={
        <Button variant="primary" asChild>
          <Link href="/admin/categories/new">
            <Plus className="size-4" aria-hidden />
            New category
          </Link>
        </Button>
      }
      errorAlert={errorAlert}
      chips={chips}
      filters={filters}
      hasFilters={Boolean(query.includeArchived)}
      resetHref={buildListHref("/admin/categories", {}, { includeArchived: "", offset: 0 })}
      view={view}
      empty={empty}
      pagination={pagination}
    />
  );
}
