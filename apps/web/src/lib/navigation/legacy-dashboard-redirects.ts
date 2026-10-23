/**
 * Dashboard URLs that no longer have a page of their own. They are permanent so that old
 * bookmarks, emails and notification links keep landing somewhere useful, and so search
 * engines and browsers stop requesting the old address.
 *
 * Kept as plain data (no imports) because `next.config.ts` loads it before the app compiles.
 * Query strings pass through, so `/dashboard/portfolio?payment=due` keeps its filter.
 */
export type LegacyDashboardRedirect = {
  source: string;
  destination: string;
  permanent: true;
};

export const LEGACY_DASHBOARD_REDIRECTS: readonly LegacyDashboardRedirect[] = [
  // Owned works and payments are one page of purchases.
  { source: "/dashboard/portfolio", destination: "/dashboard/purchases", permanent: true },
  {
    source: "/dashboard/payments",
    destination: "/dashboard/purchases#payment-history",
    permanent: true,
  },
  // Telephone bids and condition reports are sections of My bids, shown when there are any.
  {
    source: "/dashboard/telephone-bids",
    destination: "/dashboard/bids#telephone-bids",
    permanent: true,
  },
  {
    source: "/dashboard/condition-reports",
    destination: "/dashboard/bids#condition-reports",
    permanent: true,
  },
  // An organisation's overview, members, profile, documents and payout setup are its settings
  // under Selling. `:path*` also matches the bare organisation address.
  {
    source: "/dashboard/organisations/:id/:path*",
    destination: "/dashboard/seller/organisations/:id/:path*",
    permanent: true,
  },
  // Submissions and items in sale are one Consignments list with status tabs.
  {
    source: "/dashboard/submissions",
    destination: "/dashboard/seller/consignments",
    permanent: true,
  },
  {
    source: "/dashboard/seller/in-sale",
    destination: "/dashboard/seller/consignments?tab=in-sale",
    permanent: true,
  },
  // Saved cards are created and listed during checkout, so there is nothing to manage here.
  {
    source: "/dashboard/settings/payment-methods",
    destination: "/dashboard/purchases",
    permanent: true,
  },
];
