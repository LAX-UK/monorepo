/**
 * Original works are sold on lax.art. Shop URLs that used to list them move there permanently.
 * Returns null for any other request.
 */
export function resolveOriginalWorksRedirect(requestUrl: URL, artBaseUrl: URL | null): URL | null {
  if (!artBaseUrl) return null;
  const pathname = requestUrl.pathname.replace(/\/+$/, "") || "/";
  const isOriginalsCategory = pathname === "/categories/originals";
  const isOriginalsFilter =
    pathname === "/artworks" && requestUrl.searchParams.get("type") === "original";
  if (!isOriginalsCategory && !isOriginalsFilter) return null;
  return new URL("/artworks", artBaseUrl);
}
