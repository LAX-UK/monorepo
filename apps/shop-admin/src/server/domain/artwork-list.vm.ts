import {
  ADMIN_ARTWORK_CHANNELS,
  ADMIN_ARTWORK_SALE_STATES,
  ADMIN_ARTWORK_STATES,
  ARTWORK_LIST_SEARCH_MAX_LENGTH,
  type AdminArtworkBulkVisibilityResponse,
  type AdminArtworkChannel,
  type AdminArtworkListItem,
  type AdminArtworkSaleState,
  type AdminArtworkState,
  type AdminArtworkVisibilityAction,
} from "@auction/shop-contracts";
import {
  STAFF_DEFAULT_PAGE_SIZE,
  type SortState,
  defineStatusMap,
  formatGbp,
  parseStaffPageSize,
} from "@auction/staff-ui";
import { runListLabel } from "./edition-run.vm";
import { type RawSearchParams, listHref, oneOf, singleParam } from "./list-url-state";

export const ARTWORK_LIST_PATH = "/artworks";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The artwork list's state as it appears in the page URL. Every field is optional. */
export type ArtworkListQuery = {
  q?: string;
  state?: AdminArtworkState;
  artist?: string;
  sale?: AdminArtworkSaleState;
  channel?: AdminArtworkChannel;
  /** Runs whose edition facts are not recorded or not confirmed yet. */
  facts?: "needs_review";
  /** Oldest change first; absent for the default, last changed first. */
  sort?: "updated_asc";
  /** Rows per page, absent for the default of 50. */
  limit?: string;
  cursor?: string;
  /** The artwork open in the record panel. */
  artwork?: string;
};

export const ARTWORK_STATE_LABELS: Record<AdminArtworkState, string> = {
  live: "Live",
  draft: "Draft",
  sold_out: "Sold out",
  archived: "Archived",
};

/** Views in the order staff work through them; "All" comes first and is not a state. */
export const ARTWORK_VIEW_ORDER: readonly AdminArtworkState[] = [
  "live",
  "draft",
  "sold_out",
  "archived",
];

export const presentArtworkState = defineStatusMap<AdminArtworkState>({
  // On sale now: in progress, so the dot rather than the tick of something finished.
  live: { label: ARTWORK_STATE_LABELS.live, tone: "success", shape: "dot" },
  draft: { label: ARTWORK_STATE_LABELS.draft, tone: "info" },
  sold_out: { label: ARTWORK_STATE_LABELS.sold_out, tone: "warning" },
  archived: { label: ARTWORK_STATE_LABELS.archived, tone: "neutral" },
});

export const SALE_STATE_LABELS: Record<AdminArtworkSaleState, string> = {
  for_sale: "For sale",
  price_on_application: "Price on application",
  sold: "Sold",
};

export const CHANNEL_LABELS: Record<AdminArtworkChannel, string> = {
  shop: "LAX Shop",
  art: "lax.art",
};

/** Reads the URL, dropping anything unrecognised so a hand-edited link still opens the list. */
export function parseArtworkListQuery(params: RawSearchParams): ArtworkListQuery {
  const q = singleParam(params.q)?.slice(0, ARTWORK_LIST_SEARCH_MAX_LENGTH);
  const state = oneOf(singleParam(params.state), ADMIN_ARTWORK_STATES);
  const artistParam = singleParam(params.artist);
  const artist = artistParam && UUID.test(artistParam) ? artistParam : undefined;
  const sale = oneOf(singleParam(params.sale), ADMIN_ARTWORK_SALE_STATES);
  const channel = oneOf(singleParam(params.channel), ADMIN_ARTWORK_CHANNELS);
  const facts = oneOf(singleParam(params.facts), ["needs_review"] as const);
  const sort = oneOf(singleParam(params.sort), ["updated_asc"] as const);
  const limit = parseStaffPageSize(singleParam(params.limit));
  const cursor = singleParam(params.cursor);
  const artworkParam = singleParam(params.artwork);
  const artwork = artworkParam && UUID.test(artworkParam) ? artworkParam : undefined;
  return {
    ...(q ? { q } : {}),
    ...(state ? { state } : {}),
    ...(artist ? { artist } : {}),
    ...(sale ? { sale } : {}),
    ...(channel ? { channel } : {}),
    ...(facts ? { facts } : {}),
    ...(sort ? { sort } : {}),
    ...(limit !== STAFF_DEFAULT_PAGE_SIZE ? { limit: String(limit) } : {}),
    ...(cursor ? { cursor } : {}),
    ...(artwork ? { artwork } : {}),
  };
}

/** The list is ordered by when each artwork last changed, on the server, newest first by default. */
export const ARTWORK_DEFAULT_SORT: SortState = { columnId: "updated", direction: "desc" };

export function artworkSortState(query: ArtworkListQuery): SortState {
  return query.sort === "updated_asc"
    ? { columnId: "updated", direction: "asc" }
    : ARTWORK_DEFAULT_SORT;
}

/** The `sort` param for a header click; null for the default. */
export function artworkSortParam(sort: SortState | null): "updated_asc" | null {
  return sort?.columnId === "updated" && sort.direction === "asc" ? "updated_asc" : null;
}

export function artworkPageSize(query: ArtworkListQuery): number {
  return query.limit ? Number(query.limit) : STAFF_DEFAULT_PAGE_SIZE;
}

/** True when a search or filter narrows the list; the view and paging do not count. */
export function hasActiveArtworkFilters(query: ArtworkListQuery): boolean {
  return Boolean(query.q || query.artist || query.sale || query.channel || query.facts);
}

/**
 * The list URL for `query` with `change` applied. Changing anything returns to the first page,
 * because a cursor only means something under the filters it was issued for.
 */
export function artworkListHref(
  query: ArtworkListQuery,
  change: { [K in keyof ArtworkListQuery]?: ArtworkListQuery[K] | null } = {},
): string {
  const next: Record<string, string | undefined> = {
    ...query,
    cursor: undefined,
    artwork: undefined,
  };
  for (const [key, value] of Object.entries(change)) next[key] = value ?? undefined;
  return listHref(ARTWORK_LIST_PATH, next);
}

export function artworkListPageHref(query: ArtworkListQuery, cursor: string): string {
  return listHref(ARTWORK_LIST_PATH, { ...query, cursor, artwork: undefined });
}

/** The same list and page with this artwork's panel open, or closed for null. */
export function artworkPanelHref(query: ArtworkListQuery, artworkId: string | null): string {
  return listHref(ARTWORK_LIST_PATH, { ...query, artwork: artworkId ?? undefined });
}

/** The query parameters the artworks API expects for this URL state. */
export function artworkListApiQuery(query: ArtworkListQuery): Record<string, string> {
  const api: Record<string, string | undefined> = {
    q: query.q,
    state: query.state,
    artistId: query.artist,
    saleState: query.sale,
    salesChannel: query.channel,
    facts: query.facts,
    sort: query.sort,
    limit: query.limit,
  };
  return Object.fromEntries(Object.entries(api).filter(([, value]) => Boolean(value))) as Record<
    string,
    string
  >;
}

/** The run column: "LAX standard 24", "Custom 40", "Open", "AP 3", or "Original". */
export function editionSizeLabel(item: Pick<AdminArtworkListItem, "run">): string {
  return item.run ? runListLabel(item.run.spec) : "Original";
}

/** The facts filter's label, for the chip and the filter menu. */
export const FACTS_FILTER_LABEL = "Edition facts: needs review";

/** What the price column says: the edition price, or why there is none. */
export function artworkPriceLabel(item: {
  printPricePence: number | null;
  run: AdminArtworkListItem["run"];
  saleState: AdminArtworkSaleState;
}): string {
  if (item.printPricePence !== null) return formatGbp(item.printPricePence);
  if (!item.run) return "On enquiry";
  return item.saleState === "price_on_application" ? "On application" : "Not priced";
}

export const VISIBILITY_ACTION_LABELS: Record<
  AdminArtworkVisibilityAction,
  { verb: string; past: string }
> = {
  publish: { verb: "Publish", past: "Published" },
  unpublish: { verb: "Unpublish", past: "Unpublished" },
  archive: { verb: "Archive", past: "Archived" },
  restore: { verb: "Restore", past: "Restored" },
};

/**
 * The bulk actions that would change at least one selected row, in a fixed order: publishing a
 * selection with no drafts, or restoring one with nothing archived, would do nothing.
 */
export function bulkVisibilityActions(
  rows: ReadonlyArray<Pick<AdminArtworkListItem, "state">>,
): AdminArtworkVisibilityAction[] {
  const states = new Set(rows.map((row) => row.state));
  const actions: AdminArtworkVisibilityAction[] = [];
  if (states.has("draft")) actions.push("publish");
  if (states.has("live") || states.has("sold_out")) actions.push("unpublish");
  if (states.has("draft") || states.has("live") || states.has("sold_out")) actions.push("archive");
  if (states.has("archived")) actions.push("restore");
  return actions;
}

const plural = (count: number) => (count === 1 ? "artwork" : "artworks");

/**
 * One sentence for the toast after a bulk change, and the refusals worth reading: "Published 3
 * artworks" and, when some were refused, which and why.
 */
export function summariseBulkVisibility(
  action: AdminArtworkVisibilityAction,
  response: AdminArtworkBulkVisibilityResponse,
  titleOf: (artworkId: string) => string,
): { message: string; tone: "success" | "warning"; refusals: string[] } {
  const changed = response.results.filter((result) => result.outcome === "changed").length;
  const refused = response.results.filter(
    (result) => result.outcome === "refused" || result.outcome === "not_found",
  );
  const { past, verb } = VISIBILITY_ACTION_LABELS[action];
  const head =
    changed > 0
      ? `${past} ${changed} ${plural(changed)}`
      : `No artworks were ${past.toLowerCase()}`;
  if (refused.length === 0) return { message: head, tone: "success", refusals: [] };
  return {
    message: `${head}. ${refused.length} could not be changed.`,
    tone: "warning",
    refusals: refused.map(
      (result) =>
        `${titleOf(result.artworkId)}: ${
          result.outcome === "not_found"
            ? "it no longer exists"
            : (result.message ?? `could not ${verb.toLowerCase()}`)
        }`,
    ),
  };
}

/** The storefronts a set of artworks sells on, for confirm copy: "LAX Shop", "lax.art" or both. */
function storefrontsOf(rows: ReadonlyArray<Pick<AdminArtworkListItem, "salesChannel">>): string {
  const channels = [...new Set(rows.map((row) => row.salesChannel))];
  const [only] = channels;
  return channels.length === 1 && only ? CHANNEL_LABELS[only] : "LAX Shop and lax.art";
}

/**
 * What a visibility change asks before it runs, for one artwork or a selection: the title names
 * what changes, the description says what the public sees afterwards, and the button names the
 * action.
 */
export function visibilityConfirmCopy(
  action: AdminArtworkVisibilityAction,
  rows: ReadonlyArray<Pick<AdminArtworkListItem, "title" | "salesChannel">>,
): { title: string; description: string; confirmLabel: string; tone: "default" | "danger" } {
  const one = rows.length === 1 ? rows[0] : undefined;
  const subject = one ? `“${one.title}”` : `${rows.length} ${plural(rows.length)}`;
  const store = storefrontsOf(rows);
  const { verb } = VISIBILITY_ACTION_LABELS[action];
  const confirmLabel = `${verb} ${one ? "artwork" : `${rows.length} ${plural(rows.length)}`}`;
  const draft = one ? "a draft" : "drafts";
  const them = one ? "it" : "them";
  switch (action) {
    case "publish":
      return {
        title: `Publish ${subject}?`,
        description: `${one ? "It goes" : "They go"} on ${store} now, where anyone can see and buy ${them}. A draft that is not ready to publish is refused and stays a draft.`,
        confirmLabel,
        tone: "default",
      };
    case "unpublish":
      return {
        title: `Unpublish ${subject}?`,
        description: `${one ? "It leaves" : "They leave"} ${store} and ${one ? "becomes" : "become"} ${draft}. Baskets can no longer buy ${them}; you can publish again later.`,
        confirmLabel,
        tone: "default",
      };
    case "archive":
      return {
        title: `Archive ${subject}?`,
        description: `${one ? "It leaves" : "They leave"} ${store} and the default views. Editions, orders and sales stay on record, and you can restore ${them} later as ${draft}.`,
        confirmLabel,
        tone: "danger",
      };
    case "restore":
      return {
        title: `Restore ${subject}?`,
        description: `${one ? "It comes" : "They come"} back as ${draft}, not yet on ${store}. Publish when ready.`,
        confirmLabel,
        tone: "default",
      };
  }
}
