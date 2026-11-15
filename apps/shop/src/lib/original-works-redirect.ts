/** The category that used to list original works; its page now redirects to lax.art. */
export const ORIGINAL_WORKS_CATEGORY_SLUG = "originals";

/** Shop sends no one to this category: its page is a redirect, so lists of categories leave it out. */
export function isOriginalWorksCategory(category: { slug: string }): boolean {
  return category.slug === ORIGINAL_WORKS_CATEGORY_SLUG;
}

/**
 * Original works are sold on lax.art. Shop URLs that used to list them move there permanently.
 * Returns null for any other request.
 */
export function resolveOriginalWorksRedirect(requestUrl: URL, artBaseUrl: URL | null): URL | null {
  if (!artBaseUrl) return null;
  const pathname = requestUrl.pathname.replace(/\/+$/, "") || "/";
  const isOriginalsCategory = pathname === `/categories/${ORIGINAL_WORKS_CATEGORY_SLUG}`;
  const isOriginalsFilter =
    pathname === "/artworks" && requestUrl.searchParams.get("type") === "original";
  if (!isOriginalsCategory && !isOriginalsFilter) return null;
  return new URL("/artworks", artBaseUrl);
}
