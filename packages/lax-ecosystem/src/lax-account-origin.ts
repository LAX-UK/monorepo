/**
 * Where LAX Account lives and the pages other products link to. Profile, addresses, security,
 * the collection (portfolio), money and the seller tools of every LAX product live there, so a
 * product links to these pages instead of keeping its own copies.
 *
 * Plain data with no imports: client components can use it without pulling in the rest of the
 * package. Each app reads `NEXT_PUBLIC_LAX_ACCOUNT_ORIGIN` itself, written out in full so Next
 * inlines the value into client bundles, and passes it to `resolveLaxAccountOrigin`.
 */
export const LOCAL_LAX_ACCOUNT_ORIGIN = "http://localhost:3040";
export const DEFAULT_LAX_ACCOUNT_ORIGIN = "https://account.lax.bid";

/** LAX Account pages that other products link to. */
export const LAX_ACCOUNT_PATHS = {
  home: "/account",
  /** Name, email and phone. */
  profile: "/account/profile",
  /** The LAX-wide address book checkout reads saved addresses from. */
  addresses: "/account/profile#addresses",
  /** Every work the person owns or is selling, with each work's documents. */
  portfolio: "/account/portfolio",
  /** The portfolio filtered to works bought through LAX Shop. */
  shopPortfolio: "/account/portfolio?product=shop",
  /** Seller tools: editions a person may sell, the sales statement, payouts, an artist's works. */
  sellingEditions: "/account/selling/editions",
  sellingSales: "/account/selling/sales",
  sellingPayouts: "/account/selling/payouts",
  sellingArtworks: "/account/selling/artworks",
  /** An artist's application to join the gallery, and where it stands. */
  sellingApplication: "/account/selling/application",
} as const;

export type LaxAccountDestination = keyof typeof LAX_ACCOUNT_PATHS;

/**
 * The configured origin without a trailing slash. Unset, it is the Account dev server in
 * development and tests, and the live portal in a production build; a test environment must set
 * its own Account origin at build time.
 */
export function resolveLaxAccountOrigin(
  configured: string | undefined,
  nodeEnv: string | undefined,
): string {
  const origin = configured?.trim().replace(/\/+$/, "");
  if (origin) return origin;
  return nodeEnv === "production" ? DEFAULT_LAX_ACCOUNT_ORIGIN : LOCAL_LAX_ACCOUNT_ORIGIN;
}

/** An absolute LAX Account URL for one of its pages. */
export function laxAccountPageUrl(origin: string, destination: LaxAccountDestination): string {
  return `${origin}${LAX_ACCOUNT_PATHS[destination]}`;
}
