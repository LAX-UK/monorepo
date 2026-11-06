import { artSignInHref } from "@/lib/auth/art-reauth.vm";
import type { MarketingBottomTab } from "@auction/marketing-ui";
import type { ReactNode } from "react";

export type ArtBottomTabKey = "home" | "artworks" | "search" | "favourites" | "account";

export const ART_FAVOURITES_HREF = "/account/favourites";
export const ART_ENQUIRIES_HREF = "/account/enquiries";

export type ArtBottomTabsInput = {
  pathname: string;
  /** Signed out: Favourites and Account open Sign in and return to the tab's own page. */
  signedOut: boolean;
  /** A gallery reply to an enquiry is waiting; shows a dot on Account. */
  replyDot: boolean;
  icons: Record<ArtBottomTabKey, ReactNode>;
};

function under(pathname: string, prefix: string): boolean {
  const path = pathname.split(/[?#]/)[0] ?? pathname;
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * The five lax.art tabs. Artworks is current on the catalogue and on the medium landings
 * (paintings, sculptures). Favourites lives under /account, so Account steps aside there and the
 * two are never current together. Search is an action: it opens the search sheet and is never
 * current (its results page, /search, leaves every tab unmarked).
 */
export function buildArtBottomTabs({
  pathname,
  signedOut,
  replyDot,
  icons,
}: ArtBottomTabsInput): MarketingBottomTab[] {
  const onFavourites = under(pathname, ART_FAVOURITES_HREF);
  const onEnquiries = under(pathname, ART_ENQUIRIES_HREF);
  const signIn = (returnTo: string) => ({
    href: artSignInHref(returnTo),
    fullPageNavigation: true as const,
  });

  return [
    { key: "home", label: "Home", icon: icons.home, href: "/", paths: ["/"] },
    {
      key: "artworks",
      label: "Artworks",
      icon: icons.artworks,
      href: "/artworks",
      paths: ["/artworks", "/paintings", "/sculptures"],
    },
    { key: "search", label: "Search", icon: icons.search, action: "search", paths: [] },
    {
      key: "favourites",
      label: "Favourites",
      icon: icons.favourites,
      paths: [ART_FAVOURITES_HREF],
      ...(signedOut ? signIn(ART_FAVOURITES_HREF) : { href: ART_FAVOURITES_HREF }),
    },
    {
      key: "account",
      label: "Account",
      icon: icons.account,
      paths: onFavourites ? [] : ["/account"],
      badge: replyDot && !signedOut && !onEnquiries ? { kind: "dot" } : null,
      ...(signedOut ? signIn("/account") : { href: "/account" }),
    },
  ];
}
