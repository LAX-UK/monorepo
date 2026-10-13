/**
 * Where each legacy www.thelax.art URL lives on the Art storefront. Google's site-move
 * guidance: one 301 to the closest equivalent page, never a bulk redirect to the homepage;
 * anything without an equivalent stays an honest 404.
 */

export type LegacyPageRule =
  /** Imported as an `editorial_page`; Art serves it at `/collector-hub/<slug>`. */
  | { kind: "page"; slug: string }
  /** Imported as a legal `editorial_page`; Art serves it at `/legal/<slug>`. */
  | { kind: "legal"; slug: string }
  /** Redirect to an existing Art route (or an absolute URL on a sibling LAX site). */
  | { kind: "route"; to: string }
  /** Same URL exists on Art; no redirect and nothing to import. */
  | { kind: "same" };

const page = (slug: string): LegacyPageRule => ({ kind: "page", slug });
const legal = (slug: string): LegacyPageRule => ({ kind: "legal", slug });
const route = (to: string): LegacyPageRule => ({ kind: "route", to });
const same: LegacyPageRule = { kind: "same" };

export const LEGACY_BID_ARCHIVE_URL = "https://lax.bid/archive";

/** Every single-segment page in the legacy sitemap and navigation. */
export const LEGACY_PAGE_RULES: Readonly<Record<string, LegacyPageRule>> = {
  "3-new-artist": page("3-new-artist"),
  "a-guide-to-collecting-street-art": page("a-guide-to-collecting-street-art"),
  "about-us": page("about-us"),
  "all-collections": route("/artworks"),
  "all-prints": route("/prints"),
  "all-sculptures": route("/sculptures"),
  "art-advisory": page("art-advisory"),
  "art-collecting-guide": page("art-collecting-guide"),
  "art-history": page("art-history"),
  "art-news": route("/art-hub"),
  "art-prints": route("/prints"),
  artist: route("/artists"),
  "client-testimonials": page("client-testimonials"),
  collections: route("/artworks"),
  "contact-us": route("/contact"),
  "cookie-policy": legal("cookies"),
  corporate: page("corporate"),
  "event-gallery": page("event-gallery"),
  faq: page("faq"),
  glossary: page("glossary"),
  "how-to-build-an-art-collection-from-scratch": page(
    "how-to-build-an-art-collection-from-scratch",
  ),
  login: same,
  "message-from-ceo": page("message-from-ceo"),
  "modern-slavery-policy": legal("modern-slavery"),
  paintings: same,
  podcast: page("podcast"),
  "prev-auction": route(LEGACY_BID_ARCHIVE_URL),
  prints: same,
  "privacy-policy": legal("privacy"),
  register: same,
  "return-policy": legal("returns"),
  sculptures: same,
  "shipping-delivery-policy": legal("shipping"),
  "terms-conditions": legal("terms"),
};

/**
 * Legacy paths the crawl cannot see (gold-list `not-in-inventory` URLs, post-cutover
 * `legacy_redirect_miss` paths) → their closest new URL. Applied last, so an entry here also
 * replaces a generated mapping. Mirror each entry into `legacy-redirects.json` to ship it
 * before the next import regenerates the file.
 */
export const LEGACY_PATH_OVERRIDES: Readonly<Record<string, string>> = {};

export function legacyPageRule(slug: string): LegacyPageRule | null {
  return Object.hasOwn(LEGACY_PAGE_RULES, slug) ? (LEGACY_PAGE_RULES[slug] ?? null) : null;
}

export function artworkPath(slug: string): string {
  return `/artworks/${encodeURIComponent(slug)}`;
}

export function artistPath(slug: string): string {
  return `/artists/${encodeURIComponent(slug)}`;
}

export function storyPath(slug: string): string {
  return `/stories/${encodeURIComponent(slug)}`;
}

export function collectorHubPath(slug: string): string {
  return `/collector-hub/${encodeURIComponent(slug)}`;
}

export function legalPath(slug: string): string {
  return `/legal/${encodeURIComponent(slug)}`;
}

export function taxonomyPageSlug(taxonomy: "style" | "technique" | "period", slug: string): string {
  return `${taxonomy}-${slug}`;
}

/**
 * Prints on the legacy site reuse their original's slug under `/print/`; the catalogue has
 * one slug namespace, so a print whose original is also imported takes a `-print` suffix.
 */
export function plannedArtworkSlug(
  kind: "original" | "print" | "sculpture",
  slug: string,
  originalSlugs: ReadonlySet<string>,
): string {
  return kind === "print" && originalSlugs.has(slug) ? `${slug}-print` : slug;
}
