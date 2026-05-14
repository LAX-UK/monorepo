import { AdminArtistsBoard } from "@/components/admin/admin-artists-board";
import { AdminListPage } from "@/components/admin/admin-list-page";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { Button } from "@/components/ui/button";
import { artistsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import type { ArtistPresetId } from "@/lib/admin/artist-list-presets";
import { artistListActivePreset, artistListPresetHref } from "@/lib/admin/artist-list-presets";
import { getAdminArtistStats } from "@/lib/data/http/admin.server";
import { PaginationFooter, StatTile } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Plus } from "lucide-react";
import Link from "next/link";

const PRESET_IDS: ArtistPresetId[] = [
  "all",
  "pending",
  "makers",
  "historical",
  "brands",
  "featured",
  "archived",
];

const PRESET_LABELS: Record<ArtistPresetId, string> = {
  all: "All",
  pending: "Pending",
  makers: "Maker–sellers",
  historical: "Historical",
  brands: "Brands",
  featured: "Featured",
  archived: "Archived",
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminArtistsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? decodeURIComponent(sp.error) : null;
  const query = artistsListController.parseQuery(sp);
  const q = query.q;

  const hasFilters = Boolean(
    q ||
      query.includeArchived ||
      query.archivedOnly ||
      (query.kind && query.kind.trim() !== "") ||
      (query.kinds && query.kinds.trim() !== "") ||
      (query.status && query.status.trim() !== "") ||
      (query.ownerUserId && query.ownerUserId.trim() !== "") ||
      query.featured === true ||
      query.verified === true ||
      (query.linked && query.linked !== "any") ||
      (query.sort && query.sort.trim() !== "" && query.sort !== "name_asc"),
  );

  let loadError: string | null = null;
  let artists: Awaited<ReturnType<typeof artistsListController.fetch>>["rows"] = [];
  let total = 0;
  let statsStrip: {
    total: string;
    pending: string;
    makers: string;
    historical: string;
    brands: string;
    featured: string;
  } | null = null;

  try {
    const [result, stats] = await Promise.all([
      artistsListController.fetch(query),
      getAdminArtistStats().catch(() => null),
    ]);
    artists = result.rows;
    total = result.total ?? 0;
    if (stats) {
      statsStrip = {
        total: String(stats.total),
        pending: String(stats.pendingReview),
        makers: String(stats.makerSellers),
        historical: String(stats.historical),
        brands: String(stats.brands),
        featured: String(stats.featured),
      };
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load artists.";
  }

  const activePreset = artistListActivePreset(sp);
  const presetChips = PRESET_IDS.map((id) => ({
    id,
    label: PRESET_LABELS[id],
    href: artistListPresetHref(id, sp),
    active: activePreset === id,
  }));

  const filters = (
    <div className="space-y-6">
      {statsStrip ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Total" value={statsStrip.total} tone="light" />
          <StatTile label="Pending review" value={statsStrip.pending} tone="light" />
          <StatTile label="Maker–sellers" value={statsStrip.makers} tone="light" />
          <StatTile label="Historical" value={statsStrip.historical} tone="light" />
          <StatTile label="Brands" value={statsStrip.brands} tone="light" />
          <StatTile label="Featured" value={statsStrip.featured} tone="light" />
        </div>
      ) : null}

      <FilterChipRow chips={presetChips} label="Artist presets" />

      <form method="get" action="/admin/artists" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-label text-[10px] uppercase tracking-widest text-secondary">
            Search
          </span>
          <input
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder="Name or slug…"
            className="h-10 w-48 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 font-body text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 md:w-56"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label text-[10px] uppercase tracking-widest text-secondary">
            Status
          </span>
          <select
            name="status"
            defaultValue={query.status ?? ""}
            className="h-10 rounded-md border border-outline-variant bg-surface-container-lowest px-2 font-body text-sm text-on-surface"
          >
            <option value="">Any</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="merged_into">Merged</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label text-[10px] uppercase tracking-widest text-secondary">
            Kind
          </span>
          <select
            name="kind"
            defaultValue={query.kind ?? ""}
            className="h-10 rounded-md border border-outline-variant bg-surface-container-lowest px-2 font-body text-sm text-on-surface"
          >
            <option value="">Any</option>
            <option value="artist">Artist</option>
            <option value="maker">Maker</option>
            <option value="brand">Brand</option>
            <option value="marque">Marque</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label text-[10px] uppercase tracking-widest text-secondary">
            Kinds (CSV)
          </span>
          <input
            name="kinds"
            type="text"
            defaultValue={query.kinds ?? ""}
            placeholder="brand,marque"
            className="h-10 w-36 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 font-body text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label text-[10px] uppercase tracking-widest text-secondary">
            Linked
          </span>
          <select
            name="linked"
            defaultValue={query.linked === "any" ? "" : (query.linked ?? "")}
            className="h-10 rounded-md border border-outline-variant bg-surface-container-lowest px-2 font-body text-sm text-on-surface"
          >
            <option value="">Any</option>
            <option value="yes">Has owner</option>
            <option value="no">No owner</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label text-[10px] uppercase tracking-widest text-secondary">
            Sort
          </span>
          <select
            name="sort"
            defaultValue={query.sort ?? "name_asc"}
            className="h-10 rounded-md border border-outline-variant bg-surface-container-lowest px-2 font-body text-sm text-on-surface"
          >
            <option value="name_asc">Name A–Z</option>
            <option value="popular">Most lots</option>
            <option value="recent">Recently updated</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label text-[10px] uppercase tracking-widest text-secondary">
            Owner user ID
          </span>
          <input
            name="ownerUserId"
            type="text"
            defaultValue={query.ownerUserId ?? ""}
            placeholder="UUID…"
            className="h-10 w-44 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 font-mono text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </label>
        <label className="flex items-center gap-2 pb-1">
          <input
            type="checkbox"
            name="featured"
            value="true"
            defaultChecked={query.featured === true}
            className="size-4 rounded border-outline-variant accent-primary"
          />
          <span className="font-body text-sm text-on-surface-variant">Featured</span>
        </label>
        <label className="flex items-center gap-2 pb-1">
          <input
            type="checkbox"
            name="verified"
            value="true"
            defaultChecked={query.verified === true}
            className="size-4 rounded border-outline-variant accent-primary"
          />
          <span className="font-body text-sm text-on-surface-variant">Verified</span>
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
        <label className="flex items-center gap-2 pb-1">
          <input
            type="checkbox"
            name="archivedOnly"
            value="true"
            defaultChecked={query.archivedOnly}
            className="size-4 rounded border-outline-variant accent-primary"
          />
          <span className="font-body text-sm text-on-surface-variant">Archived only</span>
        </label>
        <button
          type="submit"
          className="h-10 shrink-0 rounded-md bg-primary px-4 font-label text-xs uppercase tracking-widest text-on-primary transition-colors hover:bg-primary/90"
        >
          Apply
        </button>
      </form>
    </div>
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
