"use client";

import {
  CatalogFilterBar,
  type CatalogSegmentItem,
} from "@/components/admin/catalog/catalog-filter-bar";
import Link from "next/link";

const inputCls =
  "h-10 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 font-body text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50";
const selectCls =
  "h-10 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-2 font-body text-sm text-on-surface";
const labelCapsCls =
  "font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary";

type FilterDefaults = {
  q?: string | null | undefined;
  status?: string | null | undefined;
  kind?: string | null | undefined;
  sort?: string | null | undefined;
  featured?: boolean | null | undefined;
  verified?: boolean | null | undefined;
  includeArchived?: boolean | null | undefined;
};

function ArtistRegistryFilterForm({
  defaults,
}: {
  defaults: FilterDefaults;
}) {
  return (
    <form method="get" action="/admin/artists" className="space-y-4">
      <input type="hidden" name="backfill" value="" />
      <input type="hidden" name="duplicates" value="" />

      <label className="flex flex-col gap-1">
        <span className={labelCapsCls}>Search</span>
        <input
          name="q"
          type="search"
          defaultValue={defaults.q ?? ""}
          placeholder="Name or slug…"
          className={inputCls}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelCapsCls}>Status</span>
        <select name="status" defaultValue={defaults.status ?? ""} className={selectCls}>
          <option value="">Any</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="merged_into">Merged</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelCapsCls}>Kind</span>
        <select name="kind" defaultValue={defaults.kind ?? ""} className={selectCls}>
          <option value="">Any</option>
          <option value="artist">Artist</option>
          <option value="maker">Maker</option>
          <option value="brand">Brand</option>
          <option value="marque">Marque</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelCapsCls}>Sort</span>
        <select name="sort" defaultValue={defaults.sort ?? "name_asc"} className={selectCls}>
          <option value="name_asc">Name A–Z</option>
          <option value="popular">Most lots</option>
          <option value="recent">Recently updated</option>
        </select>
      </label>

      <div className="flex flex-col gap-3 border-t border-outline-variant/40 pt-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="featured"
            value="true"
            defaultChecked={defaults.featured === true}
            className="size-4 rounded border-outline-variant accent-primary"
          />
          <span className="font-body text-sm text-on-surface-variant">Featured</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="verified"
            value="true"
            defaultChecked={defaults.verified === true}
            className="size-4 rounded border-outline-variant accent-primary"
          />
          <span className="font-body text-sm text-on-surface-variant">Verified</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="includeArchived"
            value="true"
            defaultChecked={defaults.includeArchived === true}
            className="size-4 rounded border-outline-variant accent-primary"
          />
          <span className="font-body text-sm text-on-surface-variant">Include archived</span>
        </label>
      </div>

      <button
        type="submit"
        className="h-10 w-full shrink-0 rounded-md bg-primary px-4 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-primary transition-colors hover:bg-primary/90"
      >
        Apply
      </button>
    </form>
  );
}

type Props = {
  lenses: readonly CatalogSegmentItem[];
  activeLensId: string;
  activeFilterCount: number;
  filterDefaults: FilterDefaults;
  /** When duplicates or lot backfill queues are showing, filters target the indexed list instead. */
  queueModesActive: boolean;
};

export function CatalogArtistsFilterToolbar({
  lenses,
  activeLensId,
  activeFilterCount,
  filterDefaults,
  queueModesActive,
}: Props) {
  return (
    <CatalogFilterBar
      lenses={lenses}
      activeLensId={activeLensId}
      lensAriaLabel="Artist registry view"
      activeFilterCount={activeFilterCount}
      sheetTitle="Artist filters"
      sheetFilters={
        queueModesActive ? (
          <div className="space-y-4">
            <p className="font-body text-sm text-on-surface-variant">
              Detailed filters apply to the main artist registry. Use the lenses to return to All,
              Pending, Featured, Maker–sellers, or reopen Queues after triage.
            </p>
            <Link
              href="/admin/artists"
              className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary underline-offset-4 hover:underline"
            >
              Back to registry list
            </Link>
          </div>
        ) : (
          <ArtistRegistryFilterForm defaults={filterDefaults} />
        )
      }
    />
  );
}
