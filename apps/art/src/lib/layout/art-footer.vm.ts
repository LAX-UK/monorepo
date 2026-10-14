import { ART_COOKIE_SETTINGS_HASH } from "@/lib/analytics/art-consent";
import type { ArtFooterAccountState } from "@/lib/layout/art-footer-account-state";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import type { MarketingFooterColumn } from "@auction/marketing-ui";

export type ArtFooterVm = {
  columns: MarketingFooterColumn[];
};

/** Shared LAX footer order: site navigation, account, LAX products, legal (Connect is appended by the shell). */
export function buildArtFooterVm(input: {
  crossProductLinks: LaxProductLinkVm[];
  accountState: ArtFooterAccountState;
  /** Shows the link that reopens the analytics consent banner. */
  cookieSettings: boolean;
}): ArtFooterVm {
  const exploreLinks = [
    { label: "Artists", href: "/artists" },
    { label: "Artworks", href: "/artworks" },
    { label: "Exhibitions", href: "/exhibitions" },
    { label: "Search", href: "/search" },
  ];

  const discoverLinks = [
    { label: "Art Hub", href: "/art-hub" },
    { label: "Collector Hub", href: "/collector-hub" },
    { label: "How to buy", href: "/how-to-buy" },
    { label: "How to sell", href: "/how-to-sell" },
    { label: "Visit", href: "/visit" },
    { label: "Contact", href: "/contact" },
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
    { id: "explore", title: "Explore", links: exploreLinks },
    { id: "discover", title: "Discover", links: discoverLinks },
  ];

  if (accountLinks.length > 0) {
    columns.push({ id: "account", title: "Account", links: accountLinks });
  }

  if (laxProductLinks.length > 0) {
    columns.push({ id: "lax-products", title: "LAX products", links: laxProductLinks });
  }

  const legalLinks = [
    { label: "Terms of use", href: "/legal/terms" },
    { label: "Privacy notice", href: "/legal/privacy" },
  ];
  if (input.cookieSettings) {
    legalLinks.push({ label: "Cookie preferences", href: ART_COOKIE_SETTINGS_HASH });
  }
  columns.push({ id: "legal", title: "Legal", links: legalLinks });

  return { columns };
}
