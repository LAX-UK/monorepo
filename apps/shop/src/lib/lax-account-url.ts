/**
 * Where LAX Account lives, from one build-time setting: `NEXT_PUBLIC_LAX_ACCOUNT_ORIGIN`.
 *
 * LAX Account owns profile, addresses, payment methods, security, the collection, documents,
 * money and the seller tools for every LAX product. Shop keeps only "Your orders" and links here for everything else,
 * so the link must always resolve:
 * - in local development and tests it goes to the Account dev server (`localhost:3040`);
 * - in a production build without the setting it goes to the live portal.
 *
 * The origin rule and the page paths are shared with every product; they are plain data, so
 * server code and client components agree on one value.
 */
import {
  LAX_ACCOUNT_PATHS,
  resolveLaxAccountOrigin,
} from "@auction/lax-ecosystem/lax-account-origin";

export {
  DEFAULT_LAX_ACCOUNT_ORIGIN,
  LAX_ACCOUNT_PATHS,
  LOCAL_LAX_ACCOUNT_ORIGIN,
  resolveLaxAccountOrigin,
} from "@auction/lax-ecosystem/lax-account-origin";

/** An absolute LAX Account URL for a path such as `/account/portfolio`. */
export function laxAccountUrl(path: string = LAX_ACCOUNT_PATHS.home): string {
  // Written out in full so Next inlines the value into client bundles.
  const origin = resolveLaxAccountOrigin(
    process.env.NEXT_PUBLIC_LAX_ACCOUNT_ORIGIN,
    process.env.NODE_ENV,
  );
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
