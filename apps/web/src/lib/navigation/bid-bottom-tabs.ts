import { buildHostedLoginStartHref } from "@/lib/auth/hosted-login-start-href";
import type { ClientAttention } from "@/lib/navigation/client-attention";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type {
  MarketingBottomTab,
  MarketingBottomTabBadge,
} from "@auction/marketing-ui/bottom-bar/bottom-tab-config";
import type { ReactNode } from "react";

/** The icons for each tab, supplied by the component so this module stays plain data. */
export type BidTabIcons = {
  home: ReactNode;
  auctions: ReactNode;
  search: ReactNode;
  watching: ReactNode;
  account: ReactNode;
};

export type BidTabsInput = {
  signedIn: boolean;
  /** What is waiting for the signed-in client; `null` while unknown or for staff. */
  attention: ClientAttention | null;
  icons: BidTabIcons;
};

const DOT: MarketingBottomTabBadge = { kind: "dot" };

/** Watching shows a dot while the person has been outbid, the one thing it can act on. */
export function watchingBadge(attention: ClientAttention | null): MarketingBottomTabBadge | null {
  return attention && attention.outbidLots.length > 0 ? DOT : null;
}

/**
 * Account shows a dot for what the header chip asks for besides being outbid: a payment due, an
 * account in review (both are `paymentsDue`), a bank transfer with money still to send, or unread
 * notifications, which are read from here.
 */
export function accountBadge(attention: ClientAttention | null): MarketingBottomTabBadge | null {
  if (!attention) return null;
  return attention.paymentsDue > 0 ||
    attention.stillToSend.count > 0 ||
    attention.paymentsInReview ||
    attention.unreadNotifications > 0
    ? DOT
    : null;
}

/** Signed out, a protected tab opens Sign in and brings the person back to that page. */
export function signInThenReturn(destination: string): string {
  return buildHostedLoginStartHref({ next: destination });
}

/**
 * LAX Bid's phone tabs: Home, Auctions (current on sales and lots), Search (opens the search
 * sheet; results live at /search), Watching and Account. Signed out, Watching and Account go to
 * Sign in with a return to the page they stand for, and are never prefetched.
 */
export function buildBidBottomTabs({
  signedIn,
  attention,
  icons,
}: BidTabsInput): MarketingBottomTab[] {
  const protectedTab = (destination: string) =>
    signedIn
      ? { href: destination }
      : { href: signInThenReturn(destination), prefetch: false as const };
  return [
    { key: "home", label: "Home", icon: icons.home, href: "/", paths: ["/"] },
    {
      key: "auctions",
      label: "Auctions",
      icon: icons.auctions,
      href: "/sales",
      paths: ["/sales", "/lot"],
    },
    { key: "search", label: "Search", icon: icons.search, action: "search", paths: ["/search"] },
    {
      key: "watching",
      label: "Watching",
      icon: icons.watching,
      ...protectedTab(CLIENT_ROUTES.watching),
      paths: [CLIENT_ROUTES.watching],
      badge: signedIn ? watchingBadge(attention) : null,
    },
    {
      key: "account",
      label: "Account",
      icon: icons.account,
      ...protectedTab(CLIENT_ROUTES.home),
      paths: [CLIENT_ROUTES.home],
      badge: signedIn ? accountBadge(attention) : null,
    },
  ];
}
