import { AdminFailedPage } from "@/components/admin-fetch-state";
import {
  type EditorialListColumns,
  EditorialListTable,
} from "@/components/editorial/editorial-list-table.client";
import { EDITORIAL_ENTITIES } from "@/lib/editorial-entities";
import type { EditorialEntityKind } from "@/lib/editorial-entity-forms";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import {
  EDITORIAL_LIST_PAGE_SIZE,
  type EditorialListApiRow,
  type EditorialListSearch,
  type EditorialStatusFilter,
  editorialListUrl,
  filterEditorialRows,
  paginateEditorialRows,
  statusCounts,
  toEditorialListRow,
} from "@/server/domain/editorial-list.vm";
import { EmptyState, NoResultsState } from "@auction/staff-ui";
import {
  Button,
  EntityTableShell,
  FilterRow,
  Input,
  PageHeader,
  PaginationFooter,
} from "@auction/ui";
import Link from "next/link";
import { redirect } from "next/navigation";

const COLUMNS: Record<EditorialEntityKind, EditorialListColumns> = {
  exhibitions: { descriptor: "Kind", dates: true },
  stories: { descriptor: "Kind", dates: false },
  venues: { descriptor: "City", dates: false },
  pages: { descriptor: null, dates: false },
};

const STATUS_LABELS: Record<EditorialStatusFilter, string> = {
  all: "All",
  published: "Published",
  draft: "Drafts",
};

function SearchForm({
  kind,
  search,
  label,
}: {
  kind: EditorialEntityKind;
  search: EditorialListSearch;
  label: string;
}) {
  return (
    <form method="get" action={`/editorial/${kind}`} className="flex items-center gap-2">
      {search.status !== "all" ? <Input type="hidden" name="status" value={search.status} /> : null}
      <Input
        type="search"
        name="q"
        defaultValue={search.q}
        aria-label={label}
        placeholder="Search by title or slug"
        maxLength={100}
      />
      <Button type="submit" variant="outline">
        Search
      </Button>
      {search.q ? (
        <Button variant="link" asChild>
          <Link href={editorialListUrl(kind, { ...search, q: "", page: 1 })}>Clear</Link>
        </Button>
      ) : null}
    </form>
  );
}

/**
 * A list of one editorial entity. The API returns every row, so search and the status filter
 * run here on the full set; the URL carries `q`, `status` and `page` so a view can be shared.
 */
export async function EditorialListPage({
  kind,
  search,
}: {
  kind: EditorialEntityKind;
  search: EditorialListSearch;
}) {
  const entity = EDITORIAL_ENTITIES[kind];
  const result = await fetchAdminJson<{ items: EditorialListApiRow[] }>(`editorial/${kind}`);
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok")
    return <AdminFailedPage title={entity.title} status={result.status} />;

  const allRows = result.data.items.map((row) => toEditorialListRow(kind, row));
  const matching = filterEditorialRows(allRows, search);
  const page = paginateEditorialRows(matching, search.page);
  const counts = statusCounts(allRows, search.q);
  const filtered = Boolean(search.q) || search.status !== "all";

  const newAction = (
    <Button asChild>
      <Link href={`/editorial/${kind}/new`}>{entity.newLabel}</Link>
    </Button>
  );

  return (
    <div>
      <PageHeader title={entity.title} description={entity.description} actions={newAction} />
      {allRows.length === 0 ? (
        <EmptyState
          headingLevel="h2"
          illustration="frame"
          title={entity.empty.title}
          description={entity.empty.description}
          action={newAction}
        />
      ) : (
        <EntityTableShell
          responsiveMode="scroll"
          search={
            <SearchForm
              kind={kind}
              search={search}
              label={`Search ${entity.title.toLowerCase()}`}
            />
          }
          filters={
            <FilterRow
              mode="link"
              label={`Filter ${entity.title.toLowerCase()} by status`}
              items={(["all", "published", "draft"] as const).map((status) => ({
                id: status,
                label: STATUS_LABELS[status],
                badge: counts[status],
                active: search.status === status,
                href: editorialListUrl(kind, { ...search, status, page: 1 }),
              }))}
            />
          }
          table={
            page.rows.length === 0 ? (
              <NoResultsState
                headingLevel="h2"
                title={`No ${entity.title.toLowerCase()} match`}
                description="Try a different search or show every status."
                action={
                  filtered ? (
                    <Button variant="outline" asChild>
                      <Link href={`/editorial/${kind}`}>Clear search and filters</Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-4">
                <EditorialListTable
                  entity={entity}
                  rows={page.rows}
                  columns={COLUMNS[kind]}
                  empty={entity.empty}
                />
                <PaginationFooter
                  offset={page.offset}
                  limit={EDITORIAL_LIST_PAGE_SIZE}
                  total={page.total}
                  countOnPage={page.rows.length}
                  prevHref={
                    page.hasPrevious
                      ? editorialListUrl(kind, { ...search, page: page.page - 1 })
                      : null
                  }
                  nextHref={
                    page.hasNext ? editorialListUrl(kind, { ...search, page: page.page + 1 }) : null
                  }
                />
              </div>
            )
          }
        />
      )}
    </div>
  );
}
