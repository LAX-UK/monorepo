import { AdminCategoriesBoard } from "@/components/admin/admin-categories-board";
import { AdminListPage } from "@/components/admin/admin-list-page";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { Button } from "@/components/ui/button";
import { categoriesListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
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
  let listError: string | null = null;

  try {
    const result = await categoriesListController.fetch(query);
    categories = result.rows;
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
      view={view}
      empty={empty}
    />
  );
}
