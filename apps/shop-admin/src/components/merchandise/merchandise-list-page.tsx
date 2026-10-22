import { AdminFailedPage } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { MerchandiseListTable } from "@/components/merchandise/merchandise-list-table.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import {
  type MerchandiseListSearch,
  type MerchandiseStatusFilter,
  merchandiseApiQuery,
  merchandiseListUrl,
  toMerchandiseListRow,
} from "@/server/domain/merchandise-list.vm";
import type { MerchandiseProductList } from "@auction/shop-contracts";
import { Button, EmptyState, EntityTableShell, FilterRow, Input, PageHeader } from "@auction/ui";
import Link from "next/link";
import { redirect } from "next/navigation";

const STATUS_LABELS: Record<MerchandiseStatusFilter, string> = {
  all: "All",
  active: "On sale",
  archived: "Archived",
};

function SearchForm({ search }: { search: MerchandiseListSearch }) {
  return (
    <form method="get" action="/merchandise" className="flex items-center gap-2">
      {search.status !== "all" ? <Input type="hidden" name="status" value={search.status} /> : null}
      <Input
        type="search"
        name="q"
        defaultValue={search.q}
        aria-label="Search products"
        placeholder="Search by title, slug or SKU"
        maxLength={100}
      />
      <Button type="submit" variant="outline">
        Search
      </Button>
      {search.q ? (
        <Button variant="link" asChild>
          <Link href={merchandiseListUrl({ ...search, q: "", cursor: undefined })}>Clear</Link>
        </Button>
      ) : null}
    </form>
  );
}

/**
 * The products list. Search text, the status filter and the page cursor live in the URL so a view
 * can be shared. There is no loading boundary around it, because it navigates by query string.
 */
export async function MerchandiseListPage({ search }: { search: MerchandiseListSearch }) {
  const result = await fetchAdminJson<MerchandiseProductList>(
    adminListPath("merchandise/products", {
      cursor: search.cursor,
      query: merchandiseApiQuery(search),
    }),
  );
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") return <AdminFailedPage title="Products" status={result.status} />;

  const rows = result.data.items.map(toMerchandiseListRow);
  const filtered = Boolean(search.q) || search.status !== "all";
  const newAction = (
    <Button asChild>
      <Link href="/merchandise/new">New product</Link>
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Products"
        description="Merchandise sold on the shop, with its variants, prices and stock."
        actions={newAction}
      />
      {rows.length === 0 && !filtered ? (
        <EmptyState
          headingLevel="h2"
          title="No products yet"
          description="Create a product to start selling merchandise on the shop."
          action={newAction}
        />
      ) : (
        <EntityTableShell
          responsiveMode="scroll"
          search={<SearchForm search={search} />}
          filters={
            <FilterRow
              mode="link"
              label="Filter products by status"
              items={(["all", "active", "archived"] as const).map((status) => ({
                id: status,
                label: STATUS_LABELS[status],
                active: search.status === status,
                href: merchandiseListUrl({ ...search, status, cursor: undefined }),
              }))}
            />
          }
          table={
            rows.length === 0 ? (
              <EmptyState
                headingLevel="h2"
                title="No products match"
                description="Try a different search, or show every status."
                action={
                  <Button variant="outline" asChild>
                    <Link href="/merchandise">Clear search and filters</Link>
                  </Button>
                }
              />
            ) : (
              <div>
                <MerchandiseListTable rows={rows} />
                <AdminListCursorNav
                  pathname="/merchandise"
                  cursor={search.cursor}
                  nextCursor={result.data.nextCursor}
                  query={merchandiseApiQuery(search)}
                />
              </div>
            )
          }
        />
      )}
    </div>
  );
}
