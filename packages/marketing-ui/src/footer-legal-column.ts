import type { MarketingFooterColumn, MarketingFooterLink } from "./marketing-footer.js";

/** The names every LAX footer uses for its legal links. */
export const FOOTER_LEGAL = {
  columnTitle: "Legal",
  index: "Legal and policies",
  terms: "Terms",
  privacy: "Privacy",
  cookies: "Cookies",
  cookiePreferences: "Cookie settings",
} as const;

const LEGAL_LINK_ORDER = ["index", "terms", "privacy", "cookies", "cookiePreferences"] as const;

type FooterLegalHrefs = {
  /** Where every policy is listed. */
  index?: string | undefined;
  terms?: string | undefined;
  privacy?: string | undefined;
  cookies?: string | undefined;
  /** Reopens the consent choices. */
  cookiePreferences?: string | undefined;
};

/**
 * The Legal column of a LAX footer: the index of every policy, then terms, privacy and cookies.
 * Each product says where those live; a link it has no page for is left out, and the column is
 * `null` when nothing is left. The full list stays one click away, behind the index.
 */
export function buildFooterLegalColumn(hrefs: FooterLegalHrefs): MarketingFooterColumn | null {
  const links: MarketingFooterLink[] = LEGAL_LINK_ORDER.flatMap((key) => {
    const href = hrefs[key];
    return href ? [{ label: FOOTER_LEGAL[key], href }] : [];
  });
  if (links.length === 0) return null;
  return { id: "legal", title: FOOTER_LEGAL.columnTitle, links };
}
