import { artServices } from "@/lib/art-services.server";
import { loadViewerFavoriteContext } from "@/lib/favorites/viewer-favorites";
import {
  ART_VIEWER_RESPONSE_HEADERS,
  type ArtViewerFavouritesSnapshot,
} from "@/lib/viewer/art-viewer-snapshot";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * A signed-in visitor's saved artworks and followed artists, for a prerendered page to seed its
 * hearts and Follow buttons. Guests get empty lists without a favourites read.
 */
export async function GET() {
  const context = await loadViewerFavoriteContext(artServices, "/", {
    savedArtworks: true,
    followedArtists: true,
  });
  const body: ArtViewerFavouritesSnapshot = {
    savedArtworkSlugs: [...context.savedArtworkSlugs],
    followedArtistSlugs: [...context.followedArtistSlugs],
  };
  return NextResponse.json(body, { headers: ART_VIEWER_RESPONSE_HEADERS });
}
