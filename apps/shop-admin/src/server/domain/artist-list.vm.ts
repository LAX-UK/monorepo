import { ARTWORK_LIST_SEARCH_MAX_LENGTH } from "@auction/shop-contracts";
import { defineStatusMap } from "@auction/staff-ui";
import { type RawSearchParams, listHref, oneOf, singleParam } from "./list-url-state";

export const ARTIST_LIST_PATH = "/artists";

/** Active is the default view: archived artists are kept for history, not day-to-day work. */
export const ARTIST_VIEWS = ["active", "archived", "all"] as const;
export type ArtistView = (typeof ARTIST_VIEWS)[number];

export const ARTIST_VIEW_LABELS: Record<ArtistView, string> = {
  active: "Active",
  archived: "Archived",
  all: "All",
};

export type ArtistListQuery = { q?: string; view?: Exclude<ArtistView, "active">; cursor?: string };

export const presentArtistStatus = defineStatusMap<"active" | "archived">({
  active: { label: "Active", tone: "success" },
  archived: { label: "Archived", tone: "neutral" },
});

export function parseArtistListQuery(params: RawSearchParams): ArtistListQuery {
  const q = singleParam(params.q)?.slice(0, ARTWORK_LIST_SEARCH_MAX_LENGTH);
  const view = oneOf(singleParam(params.view), ["archived", "all"] as const);
  const cursor = singleParam(params.cursor);
  return {
    ...(q ? { q } : {}),
    ...(view ? { view } : {}),
    ...(cursor ? { cursor } : {}),
  };
}

export function artistListView(query: ArtistListQuery): ArtistView {
  return query.view ?? "active";
}

export function artistListHref(
  query: ArtistListQuery,
  change: { q?: string | null; view?: ArtistView | null } = {},
): string {
  const view =
    change.view === undefined ? query.view : change.view === "active" ? undefined : change.view;
  const q = change.q === undefined ? query.q : (change.q ?? undefined);
  return listHref(ARTIST_LIST_PATH, { q, view: view ?? undefined });
}

export function artistListPageHref(query: ArtistListQuery, cursor: string): string {
  return listHref(ARTIST_LIST_PATH, { ...query, cursor });
}

export function artistListApiQuery(query: ArtistListQuery): Record<string, string> {
  const view = artistListView(query);
  return {
    ...(query.q ? { q: query.q } : {}),
    ...(view === "all" ? {} : { status: view }),
  };
}
