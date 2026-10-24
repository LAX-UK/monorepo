import { loadShopArtBaseUrl } from "@/lib/ecosystem/product-directory.server";
import { fetchPublicArtworkBySlug } from "@/lib/shop-api.server";

/**
 * The lax.art page for an original work that a Shop link still points at, or null when the slug is
 * not an original on lax.art (or lax.art is not configured for this environment).
 */
export async function resolveOriginalArtworkUrl(slug: string): Promise<string | null> {
  const artBaseUrl = loadShopArtBaseUrl();
  if (!artBaseUrl) return null;
  const original = await fetchPublicArtworkBySlug(slug, "art").catch(() => null);
  if (!original) return null;
  return new URL(`/artworks/${encodeURIComponent(slug)}`, artBaseUrl).toString();
}
