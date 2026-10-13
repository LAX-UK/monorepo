/**
 * URL families on the legacy www.thelax.art site. Classification only: the mapping to new
 * Art routes lives in the shop-api importer, which owns slug allocation.
 */
export const LEGACY_THELAX_ORIGIN = "https://www.thelax.art";

const ARTWORK_FAMILIES = {
  collection: "original",
  print: "print",
  sculpture: "sculpture",
};

const TAXONOMY_FAMILIES = {
  "art-style": "style",
  "art-technique": "technique",
  "art-period": "period",
};

/**
 * @typedef {(
 *   | { family: "home" }
 *   | { family: "artwork"; kind: "original" | "print" | "sculpture"; slug: string }
 *   | { family: "artist"; slug: string }
 *   | { family: "series"; slug: string }
 *   | { family: "story"; slug: string }
 *   | { family: "taxonomy"; taxonomy: "style" | "technique" | "period"; slug: string }
 *   | { family: "glossary"; letter: string | null }
 *   | { family: "page"; slug: string }
 *   | { family: "unknown" }
 * )} LegacyUrlClass
 */

/** Path plus the only query the old site indexed (`/glossary?word=X`). */
export function legacyPathOf(url) {
  const parsed = new URL(url, LEGACY_THELAX_ORIGIN);
  return parsed.pathname;
}

/** @returns {LegacyUrlClass} */
export function classifyLegacyUrl(url) {
  const parsed = new URL(url, LEGACY_THELAX_ORIGIN);
  const path = parsed.pathname;
  if (path === "/" || path === "") return { family: "home" };
  if (path === "/glossary") {
    const letter = parsed.searchParams.get("word");
    return { family: "glossary", letter: letter ? letter.toUpperCase() : null };
  }
  const nested = /^\/([a-z-]+)\/([^/]+)\.html$/i.exec(path);
  if (nested) {
    const [, section, rawSlug] = nested;
    const slug = decodeURIComponent(rawSlug).toLowerCase();
    if (Object.hasOwn(ARTWORK_FAMILIES, section)) {
      return { family: "artwork", kind: ARTWORK_FAMILIES[section], slug };
    }
    if (Object.hasOwn(TAXONOMY_FAMILIES, section)) {
      return { family: "taxonomy", taxonomy: TAXONOMY_FAMILIES[section], slug };
    }
    if (section === "collections") return { family: "artist", slug };
    if (section === "art-collection") return { family: "series", slug };
    if (section === "news") return { family: "story", slug };
    return { family: "unknown" };
  }
  const single = /^\/([a-z0-9-]+)$/i.exec(path);
  if (single) return { family: "page", slug: single[1].toLowerCase() };
  return { family: "unknown" };
}

/** `<loc>` values from a sitemap or sitemap index. */
export function parseSitemapLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((match) =>
    match[1].replaceAll("&amp;", "&"),
  );
}
