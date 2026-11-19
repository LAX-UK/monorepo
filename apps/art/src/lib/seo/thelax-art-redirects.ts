import { resolveLegacyRedirect as resolveLegacyRedirectDefault } from "./legacy-redirects";
import type { LegacyRedirectResolution } from "./legacy-redirects";
import { PRESERVED_QUERY_PARAM } from "./legacy-redirects";
import thelaxArtRedirectsFile from "./thelax-art-redirects.json";

/** Hosts of the old site. Only requests for these move; test and preview hosts never do. */
export const THELAX_ART_HOSTS: ReadonlySet<string> = new Set(["thelax.art", "www.thelax.art"]);

export type ThelaxArtRedirectMatch = "exact" | "best-match" | "no-equivalent";
export type ThelaxArtRedirectType = "artwork" | "artist" | "page" | "post" | "category";

export type ThelaxArtRedirectRow = {
  /** Old path, with the query string only for URLs the old sitemap listed with one. */
  from: string;
  /** lax.art path, or an absolute https URL for pages that moved to another LAX product. */
  to: string;
  type: ThelaxArtRedirectType;
  title: string | null;
  match: ThelaxArtRedirectMatch;
};

export const thelaxArtRedirectRows = thelaxArtRedirectsFile.rows as readonly ThelaxArtRedirectRow[];

function normalizeHost(host: string): string {
  return host.split(":")[0]?.trim().toLowerCase().replace(/\.$/, "") ?? "";
}

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

type LegacyFallback = (url: URL, canonicalBaseUrl: () => URL) => LegacyRedirectResolution | null;

/**
 * Moves a request for thelax.art or www.thelax.art to lax.art in one hop: a URL in the data file
 * goes to its mapped route, an old media path to its imported copy, and anything else keeps its
 * path. Returns null for every other host, and while the app itself still answers on a thelax.art
 * host (its public URL), so a deployment that has not moved can never redirect to itself.
 */
export function createThelaxArtHostRedirect(
  rows: readonly ThelaxArtRedirectRow[],
  legacyFallback: LegacyFallback,
) {
  const byPath = new Map<string, string>();
  for (const row of rows) {
    if (!row.from.includes("?")) byPath.set(row.from, row.to);
  }

  return function resolveThelaxArtHostRedirect(
    url: URL,
    host: string,
    laxArtBaseUrl: URL,
  ): string | null {
    if (!THELAX_ART_HOSTS.has(normalizeHost(host))) return null;
    if (THELAX_ART_HOSTS.has(normalizeHost(laxArtBaseUrl.hostname))) return null;

    const path = stripTrailingSlash(url.pathname);
    const mapped = byPath.get(path) ?? byPath.get(path.toLowerCase());
    if (mapped) {
      const location = new URL(mapped, laxArtBaseUrl);
      for (const [key, value] of url.searchParams) {
        if (PRESERVED_QUERY_PARAM.test(key)) location.searchParams.append(key, value);
      }
      return location.toString();
    }

    const legacy = legacyFallback(url, () => laxArtBaseUrl);
    if (legacy?.kind === "redirect") return legacy.location;

    const location = new URL(`${url.pathname}${url.search}`, laxArtBaseUrl);
    return location.toString();
  };
}

export const resolveThelaxArtHostRedirect = createThelaxArtHostRedirect(
  thelaxArtRedirectRows,
  resolveLegacyRedirectDefault,
);
