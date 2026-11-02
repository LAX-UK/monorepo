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
  browseUpcomingSales: "Browse upcoming sales",
  howBiddingWorks: "How bidding works",
  seeWhatsOn: "See what's on now",
  browseLots: "Browse lots",
  chooseWhatWeSend: "Choose what we send",
  browseCatalogue: "Browse catalogue",
  newSubmission: "New submission",
  tryAgain: "Try again",
  signInAgain: "Sign in again",
  contactSupport: "Contact support",
  usePersonalProfile: "Switch to personal account",
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
  // Selling opens on Consignments; there is no separate overview.
  seller: CLIENT_ROUTES.consignments,
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
    description: "When you bid on a lot it appears here, with live status as the sale closes.",
  },
  purchases: {
    title: "Nothing won yet",
    description: "Lots you win appear here with payment, delivery and your invoice.",
  },
  watchlist: {
    title: "Follow lots you like",
    description: "Tap the heart on any lot. We'll remind you an hour before it closes.",
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
  /** For a member who follows consignments but does not hand in work. */
  consignmentsToFollow: {
    title: "No consignments yet",
    description:
      "Works handed to LAX appear here, from first review to sale, as soon as a colleague sends one.",
  },
  seller: {
    title: "Start your first submission",
    description:
      "Tell our specialists about an artwork or collectible. When approved, we draft the catalogue lot for you.",
  },
  sellerPayouts: {
    title: "Nothing sold yet",
    description: "Works appear here once they sell, and each payout with its statement.",
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
    title: "You're all caught up",
    description: "Outbid alerts, payment reminders and selling updates will appear here.",
  },
} as const;

/** What each account page says when its list does not load: on our side, and what is still safe. */
export const ACCOUNT_LOAD_ERROR = {
  bids: {
    title: "We couldn't load your bids",
    description: "This is on our side. Your bids are safe and still active in the sale.",
  },
  purchases: {
    title: "We couldn't load your purchases",
    description: "This is on our side. Your purchases, payments and invoices are safe.",
  },
  purchase: {
    title: "We couldn't load this purchase",
    description: "This is on our side. Your purchase, payment and invoice are safe.",
  },
  watching: {
    title: "We couldn't load the lots you follow",
    description: "This is on our side. The lots you follow are saved and reminders still go out.",
  },
  consignments: {
    title: "We couldn't load your consignments",
    description: "This is on our side. Your consignments are safe with your specialist.",
  },
  payouts: {
    title: "We couldn't load your sales and payouts",
    description: "This is on our side. Payouts still go to your bank account as scheduled.",
  },
  works: {
    title: "We couldn't load your organisation's works",
    description: "This is on our side. Your works, invoices and payments are safe.",
  },
  consignment: {
    title: "We couldn't load this consignment",
    description: "This is on our side. Your consignment is safe with your specialist.",
  },
  notifications: {
    title: "We couldn't load your notifications",
    description: "This is on our side. Outbid and payment alerts still reach your email.",
  },
  settings: {
    title: "We couldn't load your settings",
    description: "This is on our side. Your saved choices have not changed.",
  },
} as const;

export type AccountLoadErrorPage = keyof typeof ACCOUNT_LOAD_ERROR;
