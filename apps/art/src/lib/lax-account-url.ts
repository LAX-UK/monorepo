import {
  type LaxAccountDestination,
  laxAccountPageUrl,
  resolveLaxAccountOrigin,
} from "@auction/lax-ecosystem/lax-account-origin";

/**
 * An absolute LAX Account URL. lax.art keeps only favourites, follows and enquiries; profile,
 * addresses, security, the collection and money are LAX Account pages, so these links always
 * resolve: the Account dev server locally, the configured origin in a deployed build.
 */
export function laxAccountUrl(destination: LaxAccountDestination = "home"): string {
  // Written out in full so Next inlines the value into client bundles.
  const origin = resolveLaxAccountOrigin(
    process.env.NEXT_PUBLIC_LAX_ACCOUNT_ORIGIN,
    process.env.NODE_ENV,
  );
  return laxAccountPageUrl(origin, destination);
}
