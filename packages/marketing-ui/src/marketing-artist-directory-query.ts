import type { CatalogActiveFilterChip } from "./catalog-active-filter-chips.js";
import type {
  MarketingFilterLink,
  MarketingFilterLinkGroup,
} from "./marketing-filter-link-groups.js";

/**
 * Query state of a link-based artist directory (LAX Shop and lax.art). Bid's directory has its
 * own richer presets; the visible controls are the same.
 */
export type MarketingArtistDirectorySort = "name" | "recent";

export type MarketingArtistDirectoryQuery = {
  q?: string;
  /** Lower-case a–z. */
  letter?: string;
  /** Absent means A–Z. */
  sort?: "recent";
  /** Absent means all artists. */
  show?: "featured";
  cursor?: string;
};

type RawSearchParams = Readonly<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseMarketingArtistDirectoryQuery(
  searchParams: RawSearchParams,
): MarketingArtistDirectoryQuery {
  const q = first(searchParams.q)?.slice(0, 120);
  const letter = first(searchParams.letter)?.toLowerCase();
  const cursor = first(searchParams.cursor);
  return {
    ...(q ? { q } : {}),
    ...(letter && /^[a-z]$/.test(letter) ? { letter } : {}),
    ...(first(searchParams.sort) === "recent" ? { sort: "recent" as const } : {}),
    ...(first(searchParams.show) === "featured" ? { show: "featured" as const } : {}),
    ...(cursor ? { cursor } : {}),
  };
}

/**
 * Directory URL with `patch` applied. Changing any filter returns to the first page, so the
 * cursor is dropped unless the patch sets one. `null` removes a key.
 */
export function marketingArtistDirectoryHref(
  basePath: string,
  query: MarketingArtistDirectoryQuery,
  patch: {
    [K in keyof MarketingArtistDirectoryQuery]?: MarketingArtistDirectoryQuery[K] | null;
  } = {},
): string {
  const next: Record<string, string | undefined> = {
    q: query.q,
    letter: query.letter,
    sort: query.sort,
    show: query.show,
  };
  for (const [key, value] of Object.entries(patch)) {
    next[key] = value ?? undefined;
  }
  const params = new URLSearchParams();
  for (const key of ["q", "show", "letter", "sort", "cursor"] as const) {
    const value = next[key];
    if (value) params.set(key, value);
  }
  const search = params.toString();
  return search ? `${basePath}?${search}` : basePath;
}

/** Number of filters a person applied (sort and paging are not filters). */
export function marketingArtistDirectoryFilterCount(query: MarketingArtistDirectoryQuery): number {
  return [query.q, query.letter, query.show].filter(Boolean).length;
}

export type MarketingArtistDirectoryControls = {
  railGroups: MarketingFilterLinkGroup[];
  sortLinks: MarketingFilterLink[];
  activeChips: CatalogActiveFilterChip[];
  activeCount: number;
  clearHref: string;
};

/** Rail groups, sort options and removable chips for a link-based artist directory. */
export function marketingArtistDirectoryControls(
  basePath: string,
  query: MarketingArtistDirectoryQuery,
): MarketingArtistDirectoryControls {
  const href = (patch: Parameters<typeof marketingArtistDirectoryHref>[2]) =>
    marketingArtistDirectoryHref(basePath, query, patch);
  const railGroups: MarketingFilterLinkGroup[] = [
    {
      id: "show",
      title: "Show",
      links: [
        { label: "All artists", href: href({ show: null }), active: !query.show },
        {
          label: "Featured artists",
          href: href({ show: "featured" }),
          active: query.show === "featured",
        },
      ],
    },
  ];
  const sortLinks: MarketingFilterLink[] = [
    { label: "A–Z", href: href({ sort: null }), active: !query.sort },
    { label: "Recently added", href: href({ sort: "recent" }), active: query.sort === "recent" },
  ];
  const activeChips: CatalogActiveFilterChip[] = [
    ...(query.q ? [{ key: "q", label: `“${query.q}”`, removeHref: href({ q: null }) }] : []),
    ...(query.show === "featured"
      ? [{ key: "show", label: "Featured artists", removeHref: href({ show: null }) }]
      : []),
    ...(query.letter
      ? [
          {
            key: "letter",
            label: `Starts with ${query.letter.toUpperCase()}`,
            removeHref: href({ letter: null }),
          },
        ]
      : []),
  ];
  return {
    railGroups,
    sortLinks,
    activeChips,
    activeCount: marketingArtistDirectoryFilterCount(query),
    clearHref: marketingArtistDirectoryHref(basePath, {}, query.sort ? { sort: query.sort } : {}),
  };
}
