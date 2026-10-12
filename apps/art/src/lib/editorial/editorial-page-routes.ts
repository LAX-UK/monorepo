/**
 * Canonical Art routes for `editorial_page` slugs. Guides have their own top-level or
 * Collector Hub routes; legal slugs live under `/legal`; every other page is a Collector
 * Hub service page. Routes redirect non-canonical paths here so each page has one URL.
 */
export const EDITORIAL_GUIDE_ROUTES = {
  "how-to-buy": "/how-to-buy",
  "how-to-sell": "/how-to-sell",
  "101-guide": "/collector-hub/101-guide",
} as const;

export type EditorialGuideSlug = keyof typeof EDITORIAL_GUIDE_ROUTES;

export const EDITORIAL_LEGAL_SLUGS: ReadonlySet<string> = new Set([
  "privacy",
  "cookies",
  "terms",
  "accessibility",
  "returns",
  "shipping",
]);

function isGuideSlug(slug: string): slug is EditorialGuideSlug {
  return Object.hasOwn(EDITORIAL_GUIDE_ROUTES, slug);
}

export function editorialPageHref(slug: string): string {
  if (isGuideSlug(slug)) return EDITORIAL_GUIDE_ROUTES[slug];
  const encoded = encodeURIComponent(slug);
  return EDITORIAL_LEGAL_SLUGS.has(slug) ? `/legal/${encoded}` : `/collector-hub/${encoded}`;
}
