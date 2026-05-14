import { AdminArtistsBoard } from "@/components/admin/admin-artists-board";
import { AdminListPage } from "@/components/admin/admin-list-page";
import { Button } from "@/components/ui/button";
import { artistsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { PaginationFooter } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function AdminArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{
    includeArchived?: string;
    q?: string;
    error?: string;
    limit?: string;
    offset?: string;
  }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const query = artistsListController.parseQuery(sp);
  const q = query.q;
  const hasFilters = Boolean(q || query.includeArchived);

  let loadError: string | null = null;
  let artists: Awaited<ReturnType<typeof artistsListController.fetch>>["rows"] = [];
  let total = 0;
  try {
    const result = await artistsListController.fetch(query);
    artists = result.rows;
    total = result.total ?? 0;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load artists.";
  }

  const filters = (
    <form method="get" action="/admin/artists" className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1">
        <span className="font-label text-[10px] uppercase tracking-widest text-secondary">
          Search
        </span>
        <input
          name="q"
          type="search"
          defaultValue={q ?? ""}
          placeholder="Name…"
          className="h-10 w-44 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 font-body text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </label>
      <label className="flex items-center gap-2 pb-1">
        <input
          type="checkbox"
          name="includeArchived"
          value="true"
          defaultChecked={query.includeArchived}
          className="size-4 rounded border-outline-variant accent-primary"
        />
        <span className="font-body text-sm text-on-surface-variant">Include archived</span>
      </label>
      <button
        type="submit"
        className="h-10 shrink-0 rounded-md bg-primary px-4 font-label text-xs uppercase tracking-widest text-on-primary transition-colors hover:bg-primary/90"
      >
        Apply
      </button>
    </form>
  );

  const errorAlert =
    error || loadError ? (
      <Alert variant="destructive">
        <AlertTitle>Could not load artists</AlertTitle>
        <AlertDescription>{loadError ?? error}</AlertDescription>
      </Alert>
    ) : null;

  const view = !loadError ? (
    artists.length === 0 && total > 0 ? (
      <p className="font-body text-sm text-on-surface-variant">No rows on this page.</p>
    ) : (
      <AdminArtistsBoard artists={artists} searchQuery={q} hasFilters={hasFilters} />
    )
  ) : null;

  const pagination =
    !loadError && total > 0 && (query.offset > 0 || query.offset + artists.length < total) ? (
      <PaginationFooter
        offset={query.offset}
        limit={query.limit}
        total={total}
        countOnPage={artists.length}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/artists", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          query.offset + artists.length < total
            ? buildListHref("/admin/artists", sp, { offset: query.offset + query.limit })
            : null
        }
      />
    ) : null;

  return (
    <AdminListPage
      title="Artists"
      description="Manage canonical public artist profiles, client ownership links, featured state, and attribution targets."
      primaryAction={
        <Button variant="primary" asChild>
          <Link href="/admin/artists/new">
            <Plus className="size-4" aria-hidden />
            New artist
          </Link>
        </Button>
      }
      hasFilters={hasFilters}
      resetHref="/admin/artists"
      errorAlert={errorAlert}
      filters={filters}
      view={view}
      pagination={pagination}
    />
  );
}
