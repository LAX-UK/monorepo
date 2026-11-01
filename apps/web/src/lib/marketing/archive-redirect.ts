const LEGACY_ARCHIVE_PATH = "/archive";

/** Layout values the old archive used for `?view=`; the Lots view has one layout, so they are dropped. */
const LEGACY_LAYOUT_VALUES = new Set(["grid", "list", "card", "lots"]);

/**
 * The permanent redirect target for a request to the old `/archive`, keeping its filters, sort
 * and page, or null for any other path. Pure so the middleware can call it without I/O.
 */
export function legacyArchiveRedirect(url: URL): URL | null {
  if (url.pathname !== LEGACY_ARCHIVE_PATH && url.pathname !== `${LEGACY_ARCHIVE_PATH}/`) {
    return null;
  }
  const target = new URL("/results", url);
  target.searchParams.set("view", "lots");
  for (const [key, value] of url.searchParams) {
    if (key === "view" && LEGACY_LAYOUT_VALUES.has(value)) continue;
    target.searchParams.append(key, value);
  }
  return target;
}
