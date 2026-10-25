import { buildListHref } from "@/lib/admin/admin-list-params";
import { countryName } from "@/lib/admin/artists/country-options";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import { formatArtistLifespan } from "@/lib/artists/lifespan-presenter";
import { artistPath } from "@/lib/seo/url";
import type {
  AttentionStripItem,
  Metric,
  DataView as StaffDataView,
  StatusPresentation,
} from "@auction/staff-ui";
import {
  type AdminArtistListRow,
  type AdminArtistStats,
  type ArtistKind,
  type ArtistStatus,
  creatorKindConfigList,
} from "@auction/types";

export const ARTISTS_LIST_PATH = "/admin/artists";

export type ArtistsListSearch = Record<string, string | string[] | undefined>;

/** A small badge on a row: featured, verified or archived. */
export type ArtistFlag = { label: string; tone: StatusPresentation["tone"] };

/** One artist as the staff list shows it; plain data, so it crosses to the client as is. */
export type ArtistsStaffRow = {
  id: string;
  name: string;
  portraitUrl: string | null;
  statusCode: ArtistStatus | null;
  status: StatusPresentation | null;
  /** "Artist · 1920 – 1999"; the kind alone when no years are known. */
  context: string | null;
  kind: string | null;
  lifespan: string | null;
  lots: number;
  aliases: number;
  owner: string | null;
  flags: ArtistFlag[];
  updatedAt: string;
  href: string;
  editHref: string;
  duplicatesHref: string;
  /** The public profile, only while the artist is approved and not archived. */
  publicHref: string | null;
};

const count = new Intl.NumberFormat("en-GB");

export function lotCountLabel(lots: number): string {
  if (lots === 0) return "No lots yet";
  return `${count.format(lots)} ${lots === 1 ? "lot" : "lots"}`;
}

function isoOf(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

export function toArtistsStaffRows(rows: readonly AdminArtistListRow[]): ArtistsStaffRow[] {
  return rows.map((row) => {
    const kind = row.kind ? artistKindMeta(row.kind).label : null;
    const lifespanRaw = formatArtistLifespan({
      birthYear: row.birthYear,
      deathYear: row.deathYear,
    });
    const lifespan = lifespanRaw === "—" ? null : lifespanRaw;
    return {
      id: row.id,
      name: row.displayName,
      portraitUrl: row.portraitUrl,
      statusCode: row.status ?? null,
      status: row.status ? staffStatus("artist", row.status) : null,
      context: [kind, lifespan].filter(Boolean).join(" · ") || null,
      kind,
      lifespan,
      lots: row.lotCount,
      aliases: row.aliasCount,
      owner: row.ownerDisplayName?.trim() || null,
      flags: [
        ...(row.featured ? [{ label: "Featured", tone: "info" as const }] : []),
        ...(row.verified ? [{ label: "Verified", tone: "success" as const }] : []),
        ...(row.archived ? [{ label: "Archived", tone: "neutral" as const }] : []),
      ],
      updatedAt: isoOf(row.updatedAt),
      href: `${ARTISTS_LIST_PATH}/${row.id}`,
      editHref: `${ARTISTS_LIST_PATH}/${row.id}/edit`,
      duplicatesHref: `${ARTISTS_LIST_PATH}/${row.id}/duplicates`,
      publicHref:
        row.status === "approved" && !row.archived
          ? artistPath({ id: row.id, name: row.displayName })
          : null,
    };
  });
}

/** The list URL with `patch` applied; any change returns to the first page. */
export function artistsListHref(
  current: ArtistsListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  const base: ArtistsListSearch = { ...current };
  for (const key of ["error", "success", "artist", "welcome"]) delete base[key];
  return buildListHref(ARTISTS_LIST_PATH, base, { offset: null, ...patch });
}

/** The list with an artist's panel open (`?artist=`), or closed for null; keeps the page. */
export function artistPanelHref(current: ArtistsListSearch, artistId: string | null): string {
  const base: ArtistsListSearch = { ...current };
  for (const key of ["error", "success", "welcome"]) delete base[key];
  return buildListHref(ARTISTS_LIST_PATH, base, { artist: artistId });
}

/** The two queues that are not lists of artists, each its own page. */
export type ArtistsQueue = "duplicates" | "backfill";

export function artistsQueue(search: ArtistsListSearch): ArtistsQueue | null {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  if (first(search.backfill) === "1") return "backfill";
  if (first(search.duplicates) === "1") return "duplicates";
  return null;
}

export function artistsQueueHref(queue: ArtistsQueue): string {
  return `${ARTISTS_LIST_PATH}?${queue}=1`;
}

export type ArtistsLens = "all" | "pending" | "makers" | "featured" | "archived";

/** What each lens clears before it sets its own filter, so lenses never stack. */
const LENS_RESET = {
  status: null,
  kinds: null,
  kind: null,
  linked: null,
  featured: null,
  archivedOnly: null,
  includeArchived: null,
} as const;

const LENS_FILTER: Record<ArtistsLens, Record<string, string | null>> = {
  all: {},
  pending: { status: "pending" },
  makers: { linked: "yes" },
  featured: { featured: "true" },
  archived: { archivedOnly: "true", includeArchived: "true" },
};

type LensQuery = {
  archivedOnly?: boolean | undefined;
  featured?: boolean | undefined;
  linked?: "any" | "yes" | "no" | undefined;
  status?: string | undefined;
};

/** The lens the filters in force amount to. */
export function artistsActiveLens(query: LensQuery): ArtistsLens {
  if (query.archivedOnly) return "archived";
  if (query.featured) return "featured";
  if (query.linked === "yes") return "makers";
  if (query.status === "pending") return "pending";
  return "all";
}

const LENS_LABELS: ReadonlyArray<{ id: ArtistsLens; label: string }> = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "makers", label: "Maker–sellers" },
  { id: "featured", label: "Featured" },
  { id: "archived", label: "Archived" },
];

/** The artist lenses as view tabs; counts where the stats hold them (not for archived). */
export function artistsViews(
  search: ArtistsListSearch,
  stats: AdminArtistStats | null,
): StaffDataView[] {
  const totals: Partial<Record<ArtistsLens, number>> = stats
    ? {
        all: stats.total,
        pending: stats.pendingReview,
        makers: stats.makerSellers,
        featured: stats.featured,
      }
    : {};
  return LENS_LABELS.map((lens) => {
    const total = totals[lens.id];
    return {
      id: lens.id,
      label: lens.label,
      href: artistsListHref(search, { ...LENS_RESET, ...LENS_FILTER[lens.id] }),
      ...(total !== undefined ? { count: total } : {}),
    };
  });
}

/** Work waiting on the registry, each linking to where it is done. */
export function artistsAttention(
  search: ArtistsListSearch,
  input: { pendingReview: number; backfillTasks: number },
): AttentionStripItem[] {
  const { pendingReview, backfillTasks } = input;
  return [
    {
      id: "pending",
      count: pendingReview,
      label:
        pendingReview === 1 ? "artist is waiting for review" : "artists are waiting for review",
      href: artistsListHref(search, { ...LENS_RESET, ...LENS_FILTER.pending }),
      actionLabel: "Review",
      tone: "warning",
    },
    {
      id: "backfill",
      count: backfillTasks,
      label:
        backfillTasks === 1
          ? "lot artist backfill task needs review"
          : "lot artist backfill tasks need review",
      href: artistsQueueHref("backfill"),
      actionLabel: "Review",
    },
  ];
}

/** Headline numbers across the registry, from the artist stats. */
export function artistsMetrics(stats: AdminArtistStats): Metric[] {
  return [
    { id: "total", label: "Artists", value: count.format(stats.total) },
    { id: "pending", label: "Pending review", value: count.format(stats.pendingReview) },
    { id: "makers", label: "Maker–sellers", value: count.format(stats.makerSellers) },
    { id: "featured", label: "Featured", value: count.format(stats.featured) },
  ];
}

export const ARTIST_STATUS_FILTERS = [
  { value: "pending", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "merged_into", label: "Merged" },
] as const;

export const ARTIST_KIND_FILTERS = creatorKindConfigList.map((config) => ({
  value: config.kind,
  label: config.label,
}));

export const ARTIST_LINKED_FILTERS = [
  { value: "yes", label: "Has an owner account" },
  { value: "no", label: "No owner account" },
] as const;

export const ARTIST_FLAG_FILTERS = [
  { value: "featured", label: "Featured" },
  { value: "verified", label: "Verified" },
  { value: "includeArchived", label: "Include archived" },
] as const;

type ChipQuery = LensQuery & {
  kind?: string | undefined;
  categoryId?: string | undefined;
  country?: string | undefined;
  verified?: boolean | undefined;
  includeArchived?: boolean | undefined;
};

/**
 * The filters in force beyond the view tab, as chips. The search shows in its own field, the
 * sort in the column headers and a tab's own filter in the tab, so none of them repeats as a
 * chip.
 */
export function artistsFilterChips(
  search: ArtistsListSearch,
  query: ChipQuery,
  categoryLabel: string | null,
): Array<{ id: string; label: string; clearHref: string }> {
  const lens = artistsActiveLens(query);
  const chip = (id: string, label: string, clear: string[] = [id]) => ({
    id,
    label,
    clearHref: artistsListHref(search, Object.fromEntries(clear.map((key) => [key, null]))),
  });
  const chips = [];
  if (query.status && lens !== "pending") {
    chips.push(
      chip(
        "status",
        `Status: ${
          ARTIST_STATUS_FILTERS.find((item) => item.value === query.status)?.label ??
          staffStatus("artist", query.status).label
        }`,
      ),
    );
  }
  if (query.kind) {
    const label = creatorKindConfigList.find((config) => config.kind === query.kind)?.label;
    chips.push(chip("kind", `Kind: ${label ?? artistKindMeta(query.kind as ArtistKind).label}`));
  }
  if (query.linked === "no" || (query.linked === "yes" && lens !== "makers")) {
    chips.push(
      chip("linked", query.linked === "yes" ? "Has an owner account" : "No owner account"),
    );
  }
  if (query.categoryId) {
    chips.push(chip("categoryId", `Category: ${categoryLabel ?? "Unknown category"}`));
  }
  if (query.country) chips.push(chip("country", `Country: ${countryName(query.country)}`));
  if (query.featured && lens !== "featured") chips.push(chip("featured", "Featured"));
  if (query.verified) chips.push(chip("verified", "Verified"));
  if (query.includeArchived && lens !== "archived") {
    chips.push(chip("includeArchived", "Including archived"));
  }
  return chips;
}

/** True when anything narrows the list beyond the search: a tab other than All counts too. */
export function artistsFiltered(
  query: ChipQuery & {
    q?: string | undefined;
    kinds?: string | undefined;
    ownerUserId?: string | undefined;
  },
): boolean {
  return Boolean(
    query.q ||
      query.status ||
      query.kind ||
      query.kinds ||
      query.ownerUserId ||
      query.categoryId ||
      query.country ||
      query.featured ||
      query.verified ||
      query.includeArchived ||
      query.archivedOnly ||
      (query.linked && query.linked !== "any"),
  );
}

/** The server's default order: by name, A to Z. */
export const ARTISTS_DEFAULT_SORT = { columnId: "artist", direction: "asc" as const };

/** Column sort to the server's keys: name (the default), most lots, or recently updated. */
export function artistsSortHref(
  current: ArtistsListSearch,
  sort: { columnId: string; direction: "asc" | "desc" },
): string {
  if (sort.columnId === "lots") return artistsListHref(current, { sort: "popular" });
  if (sort.columnId === "updated") return artistsListHref(current, { sort: "recent" });
  return artistsListHref(current, { sort: null });
}

export function artistsSortState(sort: string | undefined) {
  if (sort === "popular") return { columnId: "lots", direction: "desc" as const };
  if (sort === "recent") return { columnId: "updated", direction: "desc" as const };
  return ARTISTS_DEFAULT_SORT;
}

/** "1–50 of 312 artists", or "1–1 of 1 artist". */
export function artistsRangeSummary(offset: number, shown: number, total: number) {
  const range = `${count.format(offset + 1)}–${count.format(offset + shown)}`;
  return `${range} of ${count.format(total)} ${total === 1 ? "artist" : "artists"}`;
}
