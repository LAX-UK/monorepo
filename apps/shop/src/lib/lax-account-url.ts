/**
 * Where LAX Account lives, from one build-time setting: `NEXT_PUBLIC_LAX_ACCOUNT_ORIGIN`.
 *
 * LAX Account owns profile, addresses, payment methods, security, the collection, documents and
 * money for every LAX product. Shop keeps only "Your orders" and links here for everything else,
 * so the link must always resolve:
 * - in local development and tests it goes to the Account dev server (`localhost:3040`);
 * - in a production build without the setting it goes to the live portal.
 *
 * Plain data with no imports, so server code and client components agree on one value.
 */
export const LOCAL_LAX_ACCOUNT_ORIGIN = "http://localhost:3040";
export const DEFAULT_LAX_ACCOUNT_ORIGIN = "https://account.lax.bid";

/** LAX Account pages that replace the retired Shop account tabs. */
export const LAX_ACCOUNT_PATHS = {
  home: "/account",
  /** Every work the person owns or is selling, with each work's documents. */
  portfolio: "/account/portfolio",
  /** The portfolio filtered to works bought through LAX Shop. */
  shopPortfolio: "/account/portfolio?product=shop",
} as const;

export function resolveLaxAccountOrigin(
  configured: string | undefined,
  nodeEnv: string | undefined,
): string {
  const origin = configured?.trim().replace(/\/+$/, "");
  if (origin) return origin;
  return nodeEnv === "production" ? DEFAULT_LAX_ACCOUNT_ORIGIN : LOCAL_LAX_ACCOUNT_ORIGIN;
}

/** An absolute LAX Account URL for a path such as `/account/portfolio`. */
export function laxAccountUrl(path: string = LAX_ACCOUNT_PATHS.home): string {
  // Written out in full so Next inlines the value into client bundles.
  const origin = resolveLaxAccountOrigin(
    process.env.NEXT_PUBLIC_LAX_ACCOUNT_ORIGIN,
    process.env.NODE_ENV,
  );
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
