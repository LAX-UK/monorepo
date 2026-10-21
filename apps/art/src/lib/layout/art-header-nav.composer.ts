import { artistHref } from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { ArtHeaderNavData } from "@/lib/layout/art-nav.vm";
import type { ArtCataloguePort } from "@/lib/ports";

export const ART_HEADER_NAV_ARTIST_LIMIT = 8;

/**
 * The root layout renders on every page, so the mega menus never wait longer than this; the
 * catalogue reads are data-cached (`artCatalogueFetch`), so a warm cache answers well within it.
 */
export const ART_HEADER_NAV_TIMEOUT_MS = 1200;

type HeaderNavCatalogue = Pick<ArtCataloguePort, "listArtists" | "listArtworkObjectTypes">;

async function loadFeaturedArtists(catalogue: HeaderNavCatalogue) {
  const curated = await catalogue.listArtists({
    limit: ART_HEADER_NAV_ARTIST_LIMIT,
    placement: "featured_artists",
  });
  // The placement is curated in Shop admin and may hold no Art-channel artists yet.
  return curated.items.length > 0
    ? curated
    : catalogue.listArtists({ limit: ART_HEADER_NAV_ARTIST_LIMIT });
}

async function loadHeaderNav(catalogue: HeaderNavCatalogue): Promise<ArtHeaderNavData> {
  const [artists, objectTypes] = await Promise.all([
    loadFeaturedArtists(catalogue),
    catalogue.listArtworkObjectTypes(),
  ]);
  return {
    artists: artists.items.map((artist) => ({
      name: artist.name,
      href: artistHref(artist.slug),
      imageUrl: artist.portraitUrl,
    })),
    objectTypes: objectTypes.items.map((facet) => facet.objectType),
  };
}

/** Mega-menu data for the header; null (plain nav links) on any failure or after the timeout. */
export async function composeArtHeaderNav(
  catalogue: HeaderNavCatalogue,
  timeoutMs: number = ART_HEADER_NAV_TIMEOUT_MS,
): Promise<ArtHeaderNavData | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    return await Promise.race([loadHeaderNav(catalogue), timeout]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
