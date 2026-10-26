import {
  SHOP_HEADER_NAV_ARTIST_LIMIT,
  SHOP_HEADER_NAV_CATEGORY_LIMIT,
  type ShopHeaderNavData,
} from "@/components/header/header-nav.config";
import { fetchPublicArtists, fetchPublicCategories } from "@/lib/shop-api.server";
import type { PublicArtistList, PublicCategoryList } from "@auction/shop-contracts";
import { cache } from "react";

/**
 * The header renders on every page, so the menus never wait longer than this; the catalogue
 * reads are data-cached, so a warm cache answers well within it.
 */
export const SHOP_HEADER_NAV_TIMEOUT_MS = 1200;

type HeaderNavSources = {
  listArtists: (input: {
    limit: number;
    placement?: "featured_artists";
    sort?: "nameAsc";
  }) => Promise<PublicArtistList>;
  listCategories: (input: { limit: number }) => Promise<PublicCategoryList>;
};

async function loadFeaturedArtists(sources: HeaderNavSources): Promise<PublicArtistList> {
  const curated = await sources.listArtists({
    limit: SHOP_HEADER_NAV_ARTIST_LIMIT,
    placement: "featured_artists",
  });
  // The placement is curated in LAX Admin and may be empty; fall back to artists by name.
  return curated.items.length > 0
    ? curated
    : sources.listArtists({ limit: SHOP_HEADER_NAV_ARTIST_LIMIT, sort: "nameAsc" });
}

async function loadHeaderNav(sources: HeaderNavSources): Promise<ShopHeaderNavData> {
  const [artists, categories] = await Promise.all([
    loadFeaturedArtists(sources),
    sources.listCategories({ limit: SHOP_HEADER_NAV_CATEGORY_LIMIT }),
  ]);
  return {
    artists: artists.items
      .filter((artist) => artist.artworkCount > 0)
      .map((artist) => ({
        name: artist.name,
        href: `/artists/${artist.slug}`,
        imageUrl: artist.portraitUrl,
      })),
    categories: categories.items
      .filter((category) => category.artworkCount > 0)
      .map((category) => ({ label: category.label, href: `/categories/${category.slug}` })),
  };
}

/** Menu data for the header; null (plain menus) on any failure or after the timeout. */
export async function composeShopHeaderNav(
  sources: HeaderNavSources,
  timeoutMs: number = SHOP_HEADER_NAV_TIMEOUT_MS,
): Promise<ShopHeaderNavData | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    return await Promise.race([loadHeaderNav(sources), timeout]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** One header-nav read per request. */
export const loadShopHeaderNav = cache(() =>
  composeShopHeaderNav({ listArtists: fetchPublicArtists, listCategories: fetchPublicCategories }),
);
