import {
  type CatalogueArtistCardVm,
  buildCatalogueArtistCards,
} from "@/lib/catalogue/catalogue-artist-card.vm";
import {
  type CatalogueArtworkCardVm,
  buildCatalogueArtworkCards,
} from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { loadViewerFavoriteContext } from "@/lib/favorites/viewer-favorites";
import type { ArtCataloguePort, ArtFavoritesReadPort, ArtViewerPort } from "@/lib/ports";
import type {
  EditorialBlock,
  PublicArtistDetail,
  PublicArtworkSummary,
} from "@auction/shop-contracts";

export type EditorialRailVm =
  | {
      kind: "artworks";
      headline: string | null;
      cards: CatalogueArtworkCardVm[];
      favoriteAuth: ArtFavoriteAuth;
    }
  | {
      kind: "artists";
      headline: string | null;
      cards: CatalogueArtistCardVm[];
      favoriteAuth: ArtFavoriteAuth;
    };

export type EditorialBodyVm = {
  blocks: EditorialBlock[];
  /** Resolved rails keyed by block index; rails whose works are all unavailable are omitted. */
  rails: Readonly<Record<number, EditorialRailVm>>;
};

/** Upper bound on catalogue reads per editorial page (one detail read per distinct slug). */
export const EDITORIAL_RAIL_MAX_LOOKUPS = 24;

type Services = {
  catalogue: Pick<ArtCataloguePort, "getArtwork" | "getArtist">;
  viewer: ArtViewerPort;
  favorites: ArtFavoritesReadPort;
};

function distinctSlugs(lists: readonly (readonly string[])[]): string[] {
  return [...new Set(lists.flat())].slice(0, EDITORIAL_RAIL_MAX_LOOKUPS);
}

async function lookupAll<T>(
  slugs: readonly string[],
  read: (slug: string) => Promise<T | null>,
): Promise<Map<string, T>> {
  const settled = await Promise.allSettled(slugs.map(read));
  const found = new Map<string, T>();
  settled.forEach((result, index) => {
    const slug = slugs[index];
    if (slug && result.status === "fulfilled" && result.value) found.set(slug, result.value);
  });
  return found;
}

function pick<T>(slugs: readonly string[], found: ReadonlyMap<string, T>): T[] {
  return slugs.flatMap((slug) => {
    const item = found.get(slug);
    return item ? [item] : [];
  });
}

/** Resolves catalogue rails referenced by editorial blocks. Never rejects; missing works are skipped. */
export async function composeEditorialBody(
  blocks: readonly EditorialBlock[],
  services: Services,
  returnTo: string,
): Promise<EditorialBodyVm> {
  const artworkRails = blocks.flatMap((block, index) =>
    block.type === "artworkRail" ? [{ index, block }] : [],
  );
  const artistRails = blocks.flatMap((block, index) =>
    block.type === "artistRail" ? [{ index, block }] : [],
  );
  if (artworkRails.length === 0 && artistRails.length === 0) {
    return { blocks: [...blocks], rails: {} };
  }

  const [artworks, artists, favorites] = await Promise.all([
    lookupAll<PublicArtworkSummary>(
      distinctSlugs(artworkRails.map(({ block }) => block.artworkSlugs)),
      (slug) => services.catalogue.getArtwork(slug),
    ),
    lookupAll<PublicArtistDetail>(
      distinctSlugs(artistRails.map(({ block }) => block.artistSlugs)),
      (slug) => services.catalogue.getArtist(slug),
    ),
    loadViewerFavoriteContext(services, returnTo, {
      savedArtworks: artworkRails.length > 0,
      followedArtists: artistRails.length > 0,
    }),
  ]);

  const rails: Record<number, EditorialRailVm> = {};
  for (const { index, block } of artworkRails) {
    const items = pick(block.artworkSlugs, artworks);
    if (items.length === 0) continue;
    rails[index] = {
      kind: "artworks",
      headline: block.headline ?? null,
      cards: buildCatalogueArtworkCards(items, favorites.savedArtworkSlugs),
      favoriteAuth: favorites.favoriteAuth,
    };
  }
  for (const { index, block } of artistRails) {
    const items = pick(block.artistSlugs, artists);
    if (items.length === 0) continue;
    rails[index] = {
      kind: "artists",
      headline: block.headline ?? null,
      cards: buildCatalogueArtistCards(items, favorites.followedArtistSlugs),
      favoriteAuth: favorites.favoriteAuth,
    };
  }
  return { blocks: [...blocks], rails };
}
