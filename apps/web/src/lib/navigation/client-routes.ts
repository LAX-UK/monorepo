/**
 * Addresses of the signed-in Bid client area. Every page here has one address that always means
 * the same thing; which account it shows comes from the account switcher, not from the path.
 *
 * Kept as plain data (no imports) because `next.config.ts` and the middleware load it.
 */
export const CLIENT_ROUTES = {
  /** The active account's first page. */
  home: "/home",
  bids: "/bids",
  purchases: "/purchases",
  checkout: "/purchases/checkout",
  watching: "/watching",
  notifications: "/notifications",
  settings: "/settings",
  selling: "/selling",
  sellingNew: "/selling/new",
  consignments: "/selling/consignments",
  /** The organisation's own works, under the Collection heading. */
  collection: "/collection",
  payouts: "/selling/payouts",
  payoutSetup: "/selling/payout-setup",
  artistProfile: "/selling/artist",
  organisation: "/organisation",
  /** Who is in the organisation and what each may do; owners and admins only. */
  team: "/team",
  organisations: "/organisations",
  invitations: "/organisations/invitations",
  verifyIdentity: "/verify-identity",
  sourceOfFunds: "/compliance/source-of-funds",
  /** Opens a link in the account it belongs to; see `account-link.ts`. */
  accountSwitch: "/switch-account",
  /** Asks before a link from another site changes the account. */
  accountSwitchConfirm: "/switch-account/confirm",
  /** "We couldn't load your accounts", with a way to try again. */
  accountsUnavailable: "/switch-account/unavailable",
  /** Puts the browser back in the account the person used last; see `account-link.ts`. */
  accountRestore: "/restore-account",
  noAccess: "/no-access",
} as const;

/** The first segment of every client-area page. */
export const CLIENT_AREA_PREFIXES = [
  "/home",
  "/bids",
  "/purchases",
  "/watching",
  "/notifications",
  "/settings",
  "/selling",
  "/organisation",
  "/team",
  "/collection",
  "/organisations",
  "/verify-identity",
  "/compliance",
  "/legal-entities",
  "/switch-account",
  "/restore-account",
  "/no-access",
] as const;

/** Whether a path belongs to the signed-in client area. */
export function isClientAreaPath(pathname: string): boolean {
  return CLIENT_AREA_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** One tab of the Organisation page. */
export type OrganisationTab = "profile" | "documents" | "payouts" | "security";

/** One tab of the Team page. */
export type TeamTab = "members";

/** The Team page, or one of its tabs; Members is the page itself. */
export function teamHref(_tab: TeamTab = "members", accountId?: string): string {
  return accountId ? withAccount(CLIENT_ROUTES.team, accountId) : CLIENT_ROUTES.team;
}

/**
 * The Organisation page, or one of its tabs. Pass the organisation's id when the link may be
 * opened from another account: the link then switches to it first.
 */
export function organisationHref(tab: OrganisationTab = "profile", accountId?: string): string {
  const path =
    tab === "profile" ? CLIENT_ROUTES.organisation : `${CLIENT_ROUTES.organisation}/${tab}`;
  return accountId ? withAccount(path, accountId) : path;
}

/** Name of the query parameter that asks to open a page in a given account. */
export const ACCOUNT_QUERY_PARAM = "account";

/** Adds `?account=<id>` to a client-area link so it opens in that account. */
export function withAccount(href: string, accountId: string): string {
  const [pathAndQuery = "", hash] = href.split("#");
  const separator = pathAndQuery.includes("?") ? "&" : "?";
  const next = `${pathAndQuery}${separator}${ACCOUNT_QUERY_PARAM}=${encodeURIComponent(accountId)}`;
  return hash === undefined ? next : `${next}#${hash}`;
}
