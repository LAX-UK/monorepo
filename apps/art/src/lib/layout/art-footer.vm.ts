import { ART_COOKIE_SETTINGS_HASH } from "@/lib/analytics/art-consent";
import type { ArtFooterAccountState } from "@/lib/layout/art-footer-account-state";
import { ART_LEGAL_INDEX_HREF, artLegalLinks } from "@/lib/layout/art-legal-links";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { LAX_ART_LEGAL_INDEX, type LaxArtPolicySlug } from "@auction/marketing-ui";
import type { MarketingFooterColumn } from "@auction/marketing-ui";

export type ArtFooterVm = {
  columns: MarketingFooterColumn[];
};

/**
 * Figma footer (`235:226`) content inside the shared LAX column order: site navigation (About us,
 * Our services), Account, LAX products, Legal (Figma "Policies"), then Connect, which the footer
 * component appends. Figma links without an Art route (Our history, Careers, Press, Sitemap,
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
  const aboutLinks = [
    { label: "Visit", href: "/visit" },
    { label: "Contact", href: "/contact" },
  ];

  const servicesLinks = [
    { label: "How to buy", href: "/how-to-buy" },
    { label: "How to sell", href: "/how-to-sell" },
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
      { label: "Collection", href: "/account/collection" },
    );
  } else if (input.accountState.kind === "disabled") {
    accountLinks.push({ label: "Account status", href: input.accountState.accountHref });
  }

  const laxProductLinks = input.crossProductLinks.map((link) => ({
    label: link.label,
    href: link.href,
  }));

  const columns: MarketingFooterColumn[] = [
    { id: "about", title: "About us", links: aboutLinks },
    { id: "services", title: "Our services", links: servicesLinks },
  ];

  if (accountLinks.length > 0) {
    columns.push({ id: "account", title: "Account", links: accountLinks });
  }

  if (laxProductLinks.length > 0) {
    columns.push({ id: "lax-products", title: "LAX products", links: laxProductLinks });
  }

  const legalLinks: Array<{ label: string; href: string }> = [
    { label: LAX_ART_LEGAL_INDEX.title, href: ART_LEGAL_INDEX_HREF },
    ...artLegalLinks(input.linkablePolicies).map(({ label, href }) => ({ label, href })),
  ];
  if (input.cookieSettings) {
    legalLinks.push({ label: "Cookie preferences", href: ART_COOKIE_SETTINGS_HASH });
  }
  columns.push({ id: "legal", title: "Legal", links: legalLinks });

  return { columns };
}
