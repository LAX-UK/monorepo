import { ART_COOKIE_SETTINGS_HASH } from "@/lib/analytics/art-consent";
import type { ArtFooterAccountState } from "@/lib/layout/art-footer-account-state";
import { ART_LEGAL_INDEX_HREF, artLegalLinks } from "@/lib/layout/art-legal-links";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import {
  type LaxArtPolicySlug,
  type MarketingFooterColumn,
  buildFooterLegalColumn,
} from "@auction/marketing-ui";

export type ArtFooterVm = {
  columns: MarketingFooterColumn[];
};

/**
 * Figma footer (`235:226`) content inside the shared LAX column order: site navigation (Gallery,
 * Our services), Account, LAX products, Legal (the shared short column), then Connect, which the
 * footer component appends. Figma links without an Art route (Our history, Careers, Press, Sitemap,
 * Bidding policy) are left out.
 */
export function buildArtFooterVm(input: {
  crossProductLinks: LaxProductLinkVm[];
  accountState: ArtFooterAccountState;
  /** Shows the link that reopens the analytics consent banner. */
  cookieSettings: boolean;
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
    { label: "Collector Hub", href: "/collector-hub" },
    { label: "Help centre", href: "/help" },
  ];

  const accountLinks: Array<{ label: string; href: string }> = [];
  if (input.accountState.kind === "guest") {
    accountLinks.push(
      { label: "Sign in", href: "/login" },
      { label: "Create account", href: "/register" },
    );
  } else if (input.accountState.kind === "authenticated") {
    accountLinks.push(
      { label: "Your account", href: "/account" },
      { label: "Favourites", href: "/account/favourites" },
    );
  } else if (input.accountState.kind === "disabled") {
    accountLinks.push({ label: "Account status", href: input.accountState.accountHref });
  }

  const laxProductLinks = input.crossProductLinks.map((link) => ({
    label: link.label,
    href: link.href,
  }));

  const columns: MarketingFooterColumn[] = [
    { id: "gallery", title: "Gallery", links: galleryLinks },
    { id: "services", title: "Our services", links: servicesLinks },
  ];

  if (accountLinks.length > 0) {
    columns.push({ id: "account", title: "Account", links: accountLinks });
  }

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
    cookiePreferences: input.cookieSettings ? ART_COOKIE_SETTINGS_HASH : undefined,
  });
  if (legal) columns.push(legal);

  return { columns };
}
