import { SITE_SUPPORT_EMAIL } from "@/lib/brand";

/** Canonical dashboard meta labels (page headers). Aliases for workspace helpers — prefer `clientWorkspacePageMeta` / `clientWorkspaceOverviewMeta`. */
export const DASHBOARD_META = {
  settings: "Settings",
  organisation: "Organisation",
  buying: "Buying",
  selling: "Selling",
  collectorHome: "Collector home",
  sellerHome: "Seller home",
  actingAsOrg: "Acting as organisation",
} as const;

/** Shared CTA labels — use everywhere for consistency. */
export const DASHBOARD_CTA = {
  browseLiveAuctions: "Browse live auctions",
  browseCatalogue: "Browse catalogue",
  newSubmission: "New submission",
  tryAgain: "Try again",
  openOverview: "Open overview",
  signInAgain: "Sign in again",
  contactSupport: "Contact support",
  usePersonalProfile: "Use personal profile",
  sellerWorkspace: "Seller workspace",
  openPayoutSetup: "Open payout setup",
  itemsInSale: "View items in sale",
  myPayments: "View my payments",
  myOrganisations: "Organisations",
} as const;

export const DASHBOARD_ROUTES = {
  overview: "/dashboard",
  bids: "/dashboard/bids",
  conditionReports: "/dashboard/condition-reports",
  telephoneBids: "/dashboard/telephone-bids",
  portfolio: "/dashboard/portfolio",
  payments: "/dashboard/payments",
  watchlist: "/dashboard/watchlist",
  artistFollow: "/dashboard/watchlist?section=artists",
  notifications: "/dashboard/notifications",
  seller: "/dashboard/seller",
  submissions: "/dashboard/submissions",
  submissionsNew: "/dashboard/submissions/new",
  sellerInSale: "/dashboard/seller/in-sale",
  sellerPayouts: "/dashboard/seller/payouts",
  sellerConnect: "/dashboard/seller/connect",
  organisations: "/dashboard/organisations",
  invitations: "/dashboard/invitations",
  checkout: "/dashboard/checkout",
  signIn: "/login",
} as const;

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
  portfolio: {
    title: "Your collection is empty",
    description: "Lots you win at auction will show up in your private collection.",
  },
  payments: {
    title: "No payments yet",
    description: "Payment records for lots you win will appear here.",
  },
  watchlist: {
    title: "Your watchlist is empty",
    description: "Save lots you are interested in to track them here.",
  },
  artistFollow: {
    title: "No followed artists",
    description: "Follow artists to get updates when their work is listed.",
  },
  submissions: {
    title: "No submissions yet",
    description: "Submit item details for specialist review.",
  },
  seller: {
    title: "Start your first submission",
    description:
      "Tell our specialists about an artwork or collectible. When approved, we draft the catalogue lot for you.",
  },
  sellerInSale: {
    title: "Nothing in sale yet",
    description: "When your submissions are converted to lots, they will appear here.",
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
    description: "Add lots from your portfolio or won items to pay in one session.",
  },
  notifications: {
    title: "No notifications",
    description: "Updates about bids, sales, and account activity will appear here.",
  },
} as const;
