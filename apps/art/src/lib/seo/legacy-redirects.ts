import legacyRedirectsFile from "./legacy-redirects.json";

export type LegacyRedirectResolution =
  | { kind: "redirect"; location: string }
  | { kind: "miss"; path: string };

/** Campaign attribution survives the hop; legacy CMS params (`?word=`, `?page=`) do not. */
const PRESERVED_QUERY_PARAM = /^(utm_[a-z_]+|gclid)$/;
/** The old CMS served resized copies from `/uds/<dir>/thumb/` and `/thumb1/`. */
const LEGACY_THUMB_SEGMENT = /\/thumb1?\//;

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function isAbsoluteUrl(target: string): boolean {
  return target.startsWith("https://") || target.startsWith("http://");
}

/**
 * Resolves old www.thelax.art URLs to their final URL in one hop. Returns `null` for paths
 * that are not legacy-shaped so the request continues untouched.
 */
export function createLegacyRedirectResolver(redirects: Readonly<Record<string, string>>) {
  const map = new Map(Object.entries(redirects));
  const singlePages = new Set(
    [...map.keys()].filter((path) => !path.endsWith(".html") && !path.startsWith("/uds/")),
  );

  function isLegacyShaped(path: string): boolean {
    return (
      path.toLowerCase().endsWith(".html") ||
      path.startsWith("/uds/") ||
      singlePages.has(path) ||
      singlePages.has(path.toLowerCase())
    );
  }

  function lookup(path: string): string | undefined {
    const candidate = path.startsWith("/uds/") ? path.replace(LEGACY_THUMB_SEGMENT, "/") : path;
    return map.get(candidate) ?? map.get(candidate.toLowerCase());
  }

  return function resolveLegacyRedirect(
    url: URL,
    canonicalBaseUrl: () => URL,
  ): LegacyRedirectResolution | null {
    const path = stripTrailingSlash(url.pathname);
    if (!isLegacyShaped(path)) return null;
    const target = lookup(path);
    if (!target) return { kind: "miss", path };

    const location = isAbsoluteUrl(target) ? new URL(target) : new URL(target, canonicalBaseUrl());
    for (const [key, value] of url.searchParams) {
      if (PRESERVED_QUERY_PARAM.test(key)) location.searchParams.append(key, value);
    }
    return { kind: "redirect", location: location.toString() };
  };
}

export const legacyRedirects: Readonly<Record<string, string>> = legacyRedirectsFile.redirects;

export const resolveLegacyRedirect = createLegacyRedirectResolver(legacyRedirects);
