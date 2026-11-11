/**
 * The JavaScript a browser downloads to start a page route.
 *
 * Next writes one `app-build-manifest.json` entry per route file (`/layout`, `/error`, `/page` ...).
 * A page is rendered inside every ancestor layout and error, loading and not-found boundary, and
 * those client components ship with it, so the start-up set is the root main files, the page's own
 * entry and the entries of all of its ancestors. Reading the page entry alone leaves the layouts
 * out. The set was checked against the script tags of a rendered page (see the guide).
 */

const PAGE_SUFFIX = "/page";

/** Entries that wrap a page: each ancestor segment's layout, template and boundaries. */
const BOUNDARY_ENTRIES = ["layout", "template", "error", "loading", "not-found"];

/** Entries every page can fall back to, whatever its segment. */
const ROOT_FALLBACK_ENTRIES = ["/global-error", "/not-found"];

const isScript = (file) => file.endsWith(".js");

/** `/(a)/b/page` becomes `["", "/(a)", "/(a)/b"]`: the root and every ancestor segment path. */
export function ancestorPaths(routeKey) {
  const segments = routeKey.slice(0, -PAGE_SUFFIX.length).split("/").filter(Boolean);
  return ["", ...segments.map((_, i) => `/${segments.slice(0, i + 1).join("/")}`)];
}

/** Manifest keys of the frame around a route: boundaries of every ancestor, then the fallbacks. */
export function frameKeys(routeKey) {
  return [
    ...ancestorPaths(routeKey).flatMap((dir) => BOUNDARY_ENTRIES.map((name) => `${dir}/${name}`)),
    ...ROOT_FALLBACK_ENTRIES,
  ];
}

/**
 * The start-up scripts of one page route, split into the shared frame (root main files and the
 * ancestors' entries) and the page's own files. Each file is listed once. `null` for an unknown
 * route.
 */
export function startupSet(appManifest, buildManifest, routeKey) {
  const page = appManifest.pages?.[routeKey];
  if (!page) return null;
  const frame = new Set(buildManifest.rootMainFiles ?? []);
  for (const key of frameKeys(routeKey)) {
    for (const file of appManifest.pages[key] ?? []) frame.add(file);
  }
  const own = new Set(page.filter((file) => !frame.has(file)));
  return { frame: [...frame].filter(isScript), page: [...own].filter(isScript) };
}
