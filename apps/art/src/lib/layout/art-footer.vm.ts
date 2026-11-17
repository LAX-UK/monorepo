import { artFooterAccountLinks } from "@/lib/layout/art-footer-account-state";
import { ART_LEGAL_INDEX_HREF, artLegalLinks } from "@/lib/layout/art-legal-links";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import {
  COOKIE_SETTINGS_HASH,
  type LaxArtPolicySlug,
  type MarketingFooterColumn,
  buildFooterLegalColumn,
} from "@auction/marketing-ui";

export type ArtFooterVm = {
  columns: MarketingFooterColumn[];
};

export const ART_FOOTER_ACCOUNT_COLUMN_ID = "account";

export { artFooterAccountLinks };

/**
 * Figma footer (`235:226`) content inside the shared LAX column order: site navigation (Gallery,
 * Our services), Account, LAX products, Legal (the shared short column), then Connect, which the
 * footer component appends. Figma links without an Art route (Our history, Careers, Press, Sitemap,
 * Bidding policy) are left out.
 */
export function buildArtFooterVm(input: {
  crossProductLinks: LaxProductLinkVm[];
  /** Policies that can be linked; drafts hidden on production are left out. */
  linkablePolicies: readonly LaxArtPolicySlug[];
}): ArtFooterVm {
  const galleryLinks = [
    { label: "Visit", href: "/visit" },
    { label: "Contact", href: "/contact" },
  ];

  const servicesLinks = [
    { label: "How to buy", href: "/how-to-buy" },
    { label: "How to sell", href: "/how-to-sell" },
    { label: "For artists", href: "/for-artists" },
    { label: "Collecting", href: "/collector-hub" },
    { label: "Help centre", href: "/help" },
  ];

  const laxProductLinks = input.crossProductLinks.map((link) => ({
    label: link.label,
    href: link.href,
  }));

  const columns: MarketingFooterColumn[] = [
    { id: "gallery", title: "Gallery", links: galleryLinks },
    { id: "services", title: "Our services", links: servicesLinks },
  ];

  // Drawn as a guest's: the footer's HTML is shared between visitors, and the browser redraws
  // this column for the visitor (ArtFooterAccountList).
  columns.push({
    id: ART_FOOTER_ACCOUNT_COLUMN_ID,
    title: "Account",
    links: artFooterAccountLinks({ kind: "guest" }),
  });

  if (laxProductLinks.length > 0) {
    columns.push({ id: "lax-products", title: "LAX products", links: laxProductLinks });
  }

  const policyHref = (slug: LaxArtPolicySlug) =>
    artLegalLinks(input.linkablePolicies).find((link) => link.slug === slug)?.href;
  const legal = buildFooterLegalColumn({
    index: ART_LEGAL_INDEX_HREF,
    terms: policyHref("terms"),
    privacy: policyHref("privacy"),
    cookies: policyHref("cookies"),
    // With analytics the link reopens the consent banner; without, a dialog says only essential
    // cookies are used.
    cookiePreferences: COOKIE_SETTINGS_HASH,
  });
  if (legal) columns.push(legal);

  return { columns };
}
