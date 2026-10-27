import { SITE_SUPPORT_EMAIL } from "@/lib/brand";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";

/** Canonical dashboard meta labels (page headers). Aliases for workspace helpers — prefer `clientWorkspacePageMeta` / `clientWorkspaceOverviewMeta`. */
export const DASHBOARD_META = {
  settings: "Settings",
  organisation: "Organisation",
  buying: "Buying",
  selling: "Selling",
  collectorHome: "Collector home",
  sellerHome: "Seller home",
} as const;

/** Shared CTA labels — use everywhere for consistency. */
export const DASHBOARD_CTA = {
  browseLiveAuctions: "Browse live auctions",
  browseCatalogue: "Browse catalogue",
  newSubmission: "New submission",
  tryAgain: "Try again",
  openHome: "Go to My bids",
  signInAgain: "Sign in again",
  contactSupport: "Contact support",
  usePersonalProfile: "Switch to personal account",
  sellingOverview: "Selling overview",
  openPayoutSetup: "Open payout setup",
  itemsInSale: "View items in sale",
  myOrganisations: "Organisations",
} as const;

/** Client-area links used by dashboard copy; the addresses themselves live in `CLIENT_ROUTES`. */
export const DASHBOARD_ROUTES = {
  home: CLIENT_ROUTES.home,
  bids: CLIENT_ROUTES.bids,
  purchases: CLIENT_ROUTES.purchases,
  watchlist: CLIENT_ROUTES.watching,
  artistFollow: `${CLIENT_ROUTES.watching}?section=artists`,
  notifications: CLIENT_ROUTES.notifications,
  seller: CLIENT_ROUTES.selling,
  consignments: CLIENT_ROUTES.consignments,
  consignmentsInSale: `${CLIENT_ROUTES.consignments}?tab=in-sale`,
  submissionsNew: CLIENT_ROUTES.sellingNew,
  sellerPayouts: CLIENT_ROUTES.payouts,
  sellerConnect: CLIENT_ROUTES.payoutSetup,
  organisations: CLIENT_ROUTES.organisations,
  invitations: CLIENT_ROUTES.invitations,
  checkout: CLIENT_ROUTES.checkout,
  sofCompliance: CLIENT_ROUTES.sourceOfFunds,
  signIn: "/login",
} as const;

/** Buyer Source-of-Funds requirements and secure upload portal. */
export function dashboardSofRequirementsUrl(): string {
  return DASHBOARD_ROUTES.sofCompliance;
}

/** Per-lot checkout session (buying workspace). */
export function dashboardCheckoutLotUrl(lotId: string): string {
  return `${DASHBOARD_ROUTES.checkout}/${lotId}`;
}

/** Login URL with optional post-auth return path. */
export function dashboardLoginUrl(next?: string): string {
  if (!next?.trim()) return DASHBOARD_ROUTES.signIn;
  return `${DASHBOARD_ROUTES.signIn}?next=${encodeURIComponent(next)}`;
}

export function supportMailto(subject: string): string {
  return `mailto:${SITE_SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

/** Empty-state copy keyed by dashboard section. */
export const DASHBOARD_EMPTY = {
  bids: {
    title: "No bids yet",
    description: "When you place bids on live lots, they will appear here.",
  },
  purchases: {
    title: "No purchases yet",
    description: "Lots you win at auction, and their invoices, will appear here.",
  },
  watchlist: {
    title: "Your watchlist is empty",
    description: "Save lots you are interested in to track them here.",
  },
  artistFollow: {
    title: "No followed artists",
    description: "Follow artists to get updates when their work is listed.",
  },
  consignments: {
    title: "No consignments yet",
    description:
      "Tell our specialists about an artwork or collectible. When it is accepted, we prepare the catalogue entry for you.",
  },
  seller: {
    title: "Start your first submission",
    description:
      "Tell our specialists about an artwork or collectible. When approved, we draft the catalogue lot for you.",
  },
  sellerPayouts: {
    title: "No payouts yet",
    description: "Settlement batches appear here after your lots sell and buyers pay.",
  },
  organisations: {
    title: "No organisations yet",
    description:
      "Register an organisation or accept an invitation to manage consignments as a team.",
  },
  invitations: {
    title: "No pending invitations",
    description: "Organisation invites sent to your email will appear here.",
  },
  orgModuleComingSoon: {
    title: "Organisations — coming soon",
    description:
      "Gallery, dealer, and estate workspaces are being prepared. You'll be able to register an organisation, invite your team, and manage consignments here.",
  },
  checkout: {
    title: "Your checkout basket is empty",
    description: "Add won lots from your purchases to pay in one session.",
  },
  notifications: {
    title: "No notifications",
    description: "Updates about bids, sales, and account activity will appear here.",
  },
} as const;
