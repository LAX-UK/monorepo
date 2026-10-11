import type { ArtViewerState } from "@/lib/art-viewer-state";
import { type ArtFavoriteAuth, buildArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import type { ArtFavoritesReadPort, ArtViewerPort } from "@/lib/ports";

export type ViewerFavoriteContext = {
  viewer: ArtViewerState;
  favoriteAuth: ArtFavoriteAuth;
  savedArtworkSlugs: ReadonlySet<string>;
};

const EMPTY: ReadonlySet<string> = new Set();

/** Never rejects. Guests skip the favorites BFF; signed-in viewers pay one read per page. */
export async function loadViewerFavoriteContext(
  services: { viewer: ArtViewerPort; favorites: ArtFavoritesReadPort },
  returnTo: string,
): Promise<ViewerFavoriteContext> {
  const viewer = await services.viewer
    .load()
    .catch(
      (): ArtViewerState => ({ kind: "unavailable", message: "Account status is unavailable." }),
    );
  const savedArtworkSlugs =
    viewer.kind === "authenticated"
      ? await services.favorites.savedArtworkSlugs().catch(() => EMPTY)
      : EMPTY;
  return { viewer, favoriteAuth: buildArtFavoriteAuth(viewer, returnTo), savedArtworkSlugs };
}

export async function loadFollowedArtistSlugs(
  favorites: ArtFavoritesReadPort,
  viewer: ArtViewerState,
): Promise<ReadonlySet<string>> {
  if (viewer.kind !== "authenticated") return EMPTY;
  return favorites.followedArtistSlugs().catch(() => EMPTY);
}
