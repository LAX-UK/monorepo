import { safeRelativeReturnPath } from "@auction/identity-rp/safe-return-path";

/** Storefront `/login` and `/register` hand off to art-identity, keeping only same-site returns. */
export function artIdentityAuthStartHref(
  identityBaseUrl: string,
  flow: "login" | "register",
  returnTo: string | string[] | undefined,
): string {
  const safe = safeRelativeReturnPath(Array.isArray(returnTo) ? returnTo[0] : returnTo);
  const base = `${identityBaseUrl.replace(/\/+$/, "")}/${flow}`;
  return safe ? `${base}?returnTo=${encodeURIComponent(safe)}` : base;
}
