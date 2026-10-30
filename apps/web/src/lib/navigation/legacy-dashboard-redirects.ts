/**
 * The one map from every retired `/dashboard/...` address to the page that does the same job
 * now. The client area moved to clean addresses (`/bids`, `/selling`, `/organisation`, ...), and
 * these redirects keep old bookmarks, emails and notification links landing in the right place.
 *
 * Every rule is permanent (308), so browsers and crawlers update, and the query string passes
 * through (`/dashboard/purchases?payment=due` keeps its filter). Rules use only whole-segment
 * parameters (`:id`), never wildcards, so the map reads as a plain table and each old page has
 * exactly one row.
 *
 * Organisation settings used to carry the organisation's id in the path. They now live on one
 * Organisation page for the active account, so the id moves to `?account=`, which opens the page
 * in that organisation (switching to it when the person is a member).
 *
 * Kept as plain data (no imports) because `next.config.ts` loads it before the app compiles.
 */
export type LegacyDashboardRedirect = {
  source: string;
  destination: string;
  permanent: true;
};

function rule(source: string, destination: string): LegacyDashboardRedirect {
  return { source, destination, permanent: true };
}

/** An organisation settings page, under its retired base path, for every tab. */
function organisationRules(base: string): LegacyDashboardRedirect[] {
  return [
    rule(`${base}/:id`, "/organisation?account=:id"),
    rule(`${base}/:id/profile`, "/organisation?account=:id"),
    rule(`${base}/:id/members`, "/team?account=:id"),
    rule(`${base}/:id/documents`, "/organisation/documents?account=:id"),
    rule(`${base}/:id/connect`, "/organisation/payouts?account=:id"),
    rule(`${base}/:id/security`, "/organisation/security?account=:id"),
  ];
}

export const LEGACY_DASHBOARD_REDIRECTS: readonly LegacyDashboardRedirect[] = [
  // The client area's front door opens the active account's first page.
  rule("/dashboard", "/home"),

  // Buying.
  rule("/dashboard/bids", "/bids"),
  rule("/dashboard/telephone-bids/:id", "/bids/telephone/:id"),
  // Telephone bids and condition reports are sections of My bids, shown when there are any.
  rule("/dashboard/telephone-bids", "/bids#telephone-bids"),
  rule("/dashboard/condition-reports", "/bids#condition-reports"),
  rule("/dashboard/purchases", "/purchases"),
  rule("/dashboard/checkout", "/purchases/checkout"),
  rule("/dashboard/checkout/:lotId", "/purchases/checkout/:lotId"),
  // Owned works and payments are one page of purchases.
  rule("/dashboard/portfolio", "/purchases"),
  rule("/dashboard/payments", "/purchases#payment-history"),
  rule("/dashboard/watchlist", "/watching"),
  rule("/dashboard/artist-follow", "/watching?section=artists"),

  // Selling. Submissions and items in sale are one Consignments list with status tabs.
  rule("/dashboard/seller", "/selling/consignments"),
  rule("/dashboard/seller/consignments", "/selling/consignments"),
  rule("/dashboard/seller/in-sale", "/selling/consignments?tab=in-sale"),
  rule("/dashboard/submissions", "/selling/consignments"),
  rule("/dashboard/submissions/new", "/selling/new"),
  rule("/dashboard/submissions/:id", "/selling/consignments/:id"),
  rule("/dashboard/seller/works", "/collection"),
  rule("/dashboard/seller/payouts", "/selling/payouts"),
  rule("/dashboard/seller/connect", "/selling/payout-setup"),
  rule("/dashboard/seller/artist", "/selling/artist"),
  rule(
    "/dashboard/legal-entities/:legalEntityId/payouts/:payoutId/statement",
    "/legal-entities/:legalEntityId/payouts/:payoutId/statement",
  ),

  // Organisations.
  ...organisationRules("/dashboard/seller/organisations"),
  ...organisationRules("/dashboard/organisations"),
  rule("/dashboard/organisations", "/organisations"),
  rule("/dashboard/invitations", "/organisations/invitations"),
  rule("/dashboard/invitations/accept/:token", "/organisations/invitations/accept/:token"),
  rule("/dashboard/invitations/review/:id", "/organisations/invitations/review/:id"),

  // Account.
  rule("/dashboard/notifications", "/notifications"),
  rule("/dashboard/settings", "/settings"),
  rule("/dashboard/settings/bidding", "/settings/bidding"),
  rule("/dashboard/settings/notifications", "/settings/notifications"),
  rule("/dashboard/settings/interests", "/settings/interests"),
  rule("/dashboard/settings/appearance", "/settings/appearance"),
  // Saved cards are created and listed during checkout, so there is nothing to manage here.
  rule("/dashboard/settings/payment-methods", "/purchases"),
  rule("/dashboard/verify-identity", "/verify-identity"),
  rule("/dashboard/compliance/source-of-funds", "/compliance/source-of-funds"),

  // Retired client pages. Selling had an overview of what needs the team, which Home's
  // "Needs you" already shows; Selling now opens on Consignments.
  rule("/selling", "/selling/consignments"),
  // Team left the Organisation page for a page of its own, and Works became the organisation's
  // Collection.
  rule("/organisation/members", "/team"),
  rule("/selling/works", "/collection"),
];

/**
 * Where a retired address goes, applying the map the way the server does: each `:name` matches
 * one path segment, and the request's query string is added to the destination's.
 * `null` when no rule matches.
 */
export function resolveLegacyDashboardRedirect(
  pathname: string,
  search = "",
  rules: readonly LegacyDashboardRedirect[] = LEGACY_DASHBOARD_REDIRECTS,
): string | null {
  const segments = pathname.replace(/\/+$/, "").split("/");
  for (const { source, destination } of rules) {
    const pattern = source.split("/");
    if (pattern.length !== segments.length) continue;
    const params = new Map<string, string>();
    const matches = pattern.every((part, i) => {
      const actual = segments[i] ?? "";
      if (part.startsWith(":")) {
        if (!actual) return false;
        params.set(part.slice(1), actual);
        return true;
      }
      return part === actual;
    });
    if (!matches) continue;
    const filled = destination.replace(
      /:([A-Za-z]+)/g,
      (_, name: string) => params.get(name) ?? "",
    );
    const [beforeHash = "", hash] = filled.split("#");
    const query = search.replace(/^\?/, "");
    const withQuery = query
      ? `${beforeHash}${beforeHash.includes("?") ? "&" : "?"}${query}`
      : beforeHash;
    return hash === undefined ? withQuery : `${withQuery}#${hash}`;
  }
  return null;
}

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
