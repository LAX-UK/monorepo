import { ARTWORK_LIST_SEARCH_MAX_LENGTH } from "@auction/shop-contracts";
import { defineWorkList } from "./work-list.vm";

export const ARTIST_LIST_PATH = "/artists";

/**
 * The artist list's URL rules. Active is the default view, because archived artists are kept for
 * history rather than day-to-day work. The server orders by name, A to Z by default, or by when
 * the artist was added, with the artist id breaking ties either way.
 */
export const artistList = defineWorkList({
  path: ARTIST_LIST_PATH,
  views: [
    { id: "active", label: "Active", api: { status: "active" }, statuses: ["active"] },
    { id: "archived", label: "Archived", api: { status: "archived" }, statuses: ["archived"] },
    { id: "all", label: "All", api: {} },
  ],
  defaultView: "active",
  filters: {},
  sorts: {
    name: { asc: "name_asc", desc: "name_desc" },
    created: { asc: "created_asc", desc: "created_desc" },
  },
  defaultSort: "name_asc",
  panelParam: "artist",
  searchMaxLength: ARTWORK_LIST_SEARCH_MAX_LENGTH,
});

export type ArtistListState = ReturnType<typeof artistList.parse>;

/** The artist's record page. */
export function artistHref(artistId: string): string {
  return `${ARTIST_LIST_PATH}/${artistId}`;
}

/** The artwork list narrowed to one artist. */
export function artistArtworksHref(artistId: string): string {
  return `/artworks?artist=${artistId}`;
}

/** "3 artworks", "No artworks". */
export function artworkCountLabel(count: number): string {
  if (count === 0) return "No artworks";
  return `${count} ${count === 1 ? "artwork" : "artworks"}`;
}
