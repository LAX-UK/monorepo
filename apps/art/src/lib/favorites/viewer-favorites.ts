import type { ArtViewerState } from "@/lib/art-viewer-state";
import { type ArtFavoriteAuth, buildArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import type { ArtFavoritesReadPort, ArtViewerPort } from "@/lib/ports";

export type ViewerFavoriteContext = {
  viewer: ArtViewerState;
  favoriteAuth: ArtFavoriteAuth;
  savedArtworkSlugs: ReadonlySet<string>;
  followedArtistSlugs: ReadonlySet<string>;
};

/** Which favourites sets the page renders; each one costs a signed-in viewer one BFF read. */
export type ViewerFavoriteReads = { savedArtworks?: boolean; followedArtists?: boolean };

const EMPTY: ReadonlySet<string> = new Set();

/**
 * Never rejects. Guests skip the favorites BFF. Each set is read once per page, never per card,
 * so hearts and Follow buttons are seeded without N+1 requests.
 */
export async function loadViewerFavoriteContext(
  services: { viewer: ArtViewerPort; favorites: ArtFavoritesReadPort },
  returnTo: string,
  reads: ViewerFavoriteReads = { savedArtworks: true },
): Promise<ViewerFavoriteContext> {
  const viewer = await services.viewer
    .load()
    .catch(
      (): ArtViewerState => ({ kind: "unavailable", message: "Account status is unavailable." }),
    );
  const signedIn = viewer.kind === "authenticated";
  const [savedArtworkSlugs, followedArtistSlugs] = await Promise.all([
    signedIn && reads.savedArtworks
      ? services.favorites.savedArtworkSlugs().catch(() => EMPTY)
      : EMPTY,
    signedIn && reads.followedArtists
      ? services.favorites.followedArtistSlugs().catch(() => EMPTY)
      : EMPTY,
  ]);
  return {
    viewer,
    favoriteAuth: buildArtFavoriteAuth(viewer, returnTo),
    savedArtworkSlugs,
    followedArtistSlugs,
  };
}
