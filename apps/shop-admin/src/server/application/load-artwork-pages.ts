import type {
  AdminArtistDetail,
  AdminArtistList,
  AdminArtworkDetail,
  AdminArtworkList,
} from "@auction/shop-contracts";
import { type ArtistListState, artistList } from "../domain/artist-list.vm";
import { artworkPermissions } from "../domain/artwork-editor.vm";
import { type ArtworkListQuery, artworkListApiQuery } from "../domain/artwork-list.vm";
import { adminListPath } from "./admin-list-path";
import { type AdminFetchResult, fetchAdminJson, loadAdminSession } from "./load-admin-data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Failure = Exclude<AdminFetchResult<never>["status"], "ok">;
type PageResult<T> = { status: "ok"; data: T } | { status: Failure };

export type ArtworkPermissions = ReturnType<typeof artworkPermissions>;

async function permissionsOrUnauthorized(): Promise<ArtworkPermissions | "unauthorized"> {
  const session = await loadAdminSession();
  if (session.status === "unauthorized") return "unauthorized";
  return artworkPermissions(session.status === "ok" ? session.data.capabilities : []);
}

/**
 * The artwork list for a URL state, with what this person may do. The filtered artist's name
 * comes with their artworks; when none are listed it is read from the artist.
 */
/**
 * The artwork list page. A failed load still renders the list frame with its error, so only
 * sign-in, access and a missing resource leave the page.
 */
export async function loadArtworkListPage(query: ArtworkListQuery): Promise<
  PageResult<{
    page: AdminArtworkList;
    loadFailed: boolean;
    selectedArtistName: string | null;
    permissions: ArtworkPermissions;
  }>
> {
  const [result, permissions] = await Promise.all([
    fetchAdminJson<AdminArtworkList>(
      adminListPath("artworks", { cursor: query.cursor, query: artworkListApiQuery(query) }),
    ),
    permissionsOrUnauthorized(),
  ]);
  if (result.status === "unauthorized" || permissions === "unauthorized") {
    return { status: "unauthorized" };
  }
  if (result.status === "forbidden" || result.status === "not_found") {
    return { status: result.status };
  }
  const page: AdminArtworkList =
    result.status === "ok"
      ? result.data
      : { items: [], nextCursor: null, counts: { live: 0, draft: 0, sold_out: 0, archived: 0 } };
  let selectedArtistName = query.artist
    ? (page.items.find((item) => item.artistId === query.artist)?.artistName ?? null)
    : null;
  if (query.artist && !selectedArtistName) {
    const artist = await fetchAdminJson<AdminArtistDetail>(`artists/${query.artist}`);
    selectedArtistName = artist.status === "ok" ? artist.data.artist.displayName : null;
  }
  return {
    status: "ok",
    data: { page, loadFailed: result.status !== "ok", selectedArtistName, permissions },
  };
}

/** One artwork for its editor, or `null` detail for a new one, with what this person may do. */
export async function loadArtworkEditorPage(
  artworkId: string | null,
): Promise<PageResult<{ detail: AdminArtworkDetail | null; permissions: ArtworkPermissions }>> {
  const [result, permissions] = await Promise.all([
    artworkId
      ? fetchAdminJson<AdminArtworkDetail>(`artworks/${artworkId}`)
      : Promise.resolve({ status: "ok", data: null } as const),
    permissionsOrUnauthorized(),
  ]);
  if (result.status === "unauthorized" || permissions === "unauthorized") {
    return { status: "unauthorized" };
  }
  if (result.status !== "ok") return { status: result.status };
  return { status: "ok", data: { detail: result.data, permissions } };
}

/**
 * A blank editor, optionally for one artist (from their page's New artwork). An archived or
 * unknown artist is simply not pre-filled.
 */
export async function loadNewArtworkPage(artistId: string | undefined): Promise<
  PageResult<{
    initialArtist: { id: string; name: string } | null;
    permissions: ArtworkPermissions;
  }>
> {
  const [artist, permissions] = await Promise.all([
    artistId && UUID.test(artistId)
      ? fetchAdminJson<AdminArtistDetail>(`artists/${artistId}`)
      : Promise.resolve(null),
    permissionsOrUnauthorized(),
  ]);
  if (permissions === "unauthorized" || artist?.status === "unauthorized") {
    return { status: "unauthorized" };
  }
  const initialArtist =
    artist?.status === "ok" && !artist.data.artist.archived
      ? { id: artist.data.artist.artistId, name: artist.data.artist.displayName }
      : null;
  return { status: "ok", data: { initialArtist, permissions } };
}

/**
 * The artist list page. A failed load still renders the list frame with its error, so only
 * sign-in, access and a missing resource leave the page.
 */
export async function loadArtistListPage(state: ArtistListState): Promise<
  PageResult<{
    page: AdminArtistList;
    loadFailed: boolean;
    permissions: ArtworkPermissions;
  }>
> {
  const [result, permissions] = await Promise.all([
    fetchAdminJson<AdminArtistList>(
      adminListPath("artists", { cursor: state.cursor, query: artistList.apiQuery(state) }),
    ),
    permissionsOrUnauthorized(),
  ]);
  if (result.status === "unauthorized" || permissions === "unauthorized") {
    return { status: "unauthorized" };
  }
  if (result.status === "forbidden" || result.status === "not_found") {
    return { status: result.status };
  }
  return {
    status: "ok",
    data: {
      page: result.status === "ok" ? result.data : { items: [], nextCursor: null },
      loadFailed: result.status !== "ok",
      permissions,
    },
  };
}

export async function loadArtistPage(
  artistId: string,
): Promise<PageResult<{ detail: AdminArtistDetail; permissions: ArtworkPermissions }>> {
  const [result, permissions] = await Promise.all([
    fetchAdminJson<AdminArtistDetail>(`artists/${artistId}`),
    permissionsOrUnauthorized(),
  ]);
  if (result.status === "unauthorized" || permissions === "unauthorized") {
    return { status: "unauthorized" };
  }
  if (result.status !== "ok") return { status: result.status };
  return { status: "ok", data: { detail: result.data, permissions } };
}
