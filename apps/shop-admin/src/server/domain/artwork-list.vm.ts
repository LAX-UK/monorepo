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
import { defineStatusMap, formatGbp } from "@auction/staff-ui";
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
  cursor?: string;
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
  live: { label: ARTWORK_STATE_LABELS.live, tone: "success" },
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
  const cursor = singleParam(params.cursor);
  return {
    ...(q ? { q } : {}),
    ...(state ? { state } : {}),
    ...(artist ? { artist } : {}),
    ...(sale ? { sale } : {}),
    ...(channel ? { channel } : {}),
    ...(cursor ? { cursor } : {}),
  };
}

/** True when a search or filter narrows the list; the view and paging do not count. */
export function hasActiveArtworkFilters(query: ArtworkListQuery): boolean {
  return Boolean(query.q || query.artist || query.sale || query.channel);
}

/**
 * The list URL for `query` with `change` applied. Changing anything returns to the first page,
 * because a cursor only means something under the filters it was issued for.
 */
export function artworkListHref(
  query: ArtworkListQuery,
  change: { [K in keyof ArtworkListQuery]?: ArtworkListQuery[K] | null } = {},
): string {
  const next: Record<string, string | undefined> = { ...query, cursor: undefined };
  for (const [key, value] of Object.entries(change)) next[key] = value ?? undefined;
  return listHref(ARTWORK_LIST_PATH, next);
}

export function artworkListPageHref(query: ArtworkListQuery, cursor: string): string {
  return listHref(ARTWORK_LIST_PATH, { ...query, cursor });
}

/** The query parameters the artworks API expects for this URL state. */
export function artworkListApiQuery(query: ArtworkListQuery): Record<string, string> {
  const api: Record<string, string | undefined> = {
    q: query.q,
    state: query.state,
    artistId: query.artist,
    saleState: query.sale,
    salesChannel: query.channel,
  };
  return Object.fromEntries(Object.entries(api).filter(([, value]) => Boolean(value))) as Record<
    string,
    string
  >;
}

/** "24" for an edition run, "Original" for a unique work. */
export function editionSizeLabel(item: Pick<AdminArtworkListItem, "editionSize">): string {
  return item.editionSize > 0 ? String(item.editionSize) : "Original";
}

/** What the price column says: the edition price, or why there is none. */
export function artworkPriceLabel(item: {
  printPricePence: number | null;
  editionSize: number;
  saleState: AdminArtworkSaleState;
}): string {
  if (item.printPricePence !== null) return formatGbp(item.printPricePence);
  if (item.editionSize === 0) return "On enquiry";
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
