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

/**
 * Bid's identity settings moved to LAX Account, which owns them for every LAX product. Each
 * old page sends people to the Account page that now does the same job. Destinations are paths
 * on the Account origin; `identitySettingsRedirects` joins them to it.
 */
export const IDENTITY_SETTINGS_REDIRECTS: readonly {
  source: string;
  accountPath: string;
}[] = [
  { source: "/dashboard/settings/profile", accountPath: "/account/profile" },
  // The old page was the sign-in email and its change form. Account shows both on Profile.
  { source: "/dashboard/settings/account", accountPath: "/account/profile" },
  // Links in email-change emails carry `?t=<token>`, which passes through to the same
  // confirmation Account now serves.
  { source: "/dashboard/settings/account/confirm", accountPath: "/account/email-change" },
  { source: "/dashboard/settings/addresses", accountPath: "/account/profile" },
  { source: "/dashboard/settings/security", accountPath: "/account/security" },
  { source: "/dashboard/settings/security/two-factor", accountPath: "/account/security" },
  { source: "/dashboard/settings/sessions", accountPath: "/account/security" },
];

/** The identity redirects as full rules pointing at the given LAX Account origin. */
export function identitySettingsRedirects(accountOrigin: string): LegacyDashboardRedirect[] {
  const origin = accountOrigin.replace(/\/+$/, "");
  return IDENTITY_SETTINGS_REDIRECTS.map(({ source, accountPath }) => ({
    source,
    destination: `${origin}${accountPath}`,
    permanent: true,
  }));
}
