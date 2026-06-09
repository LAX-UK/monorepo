import { getAuthIssuerBaseUrl } from "@/lib/auth-client";
import { getSiteUrl } from "@/lib/site-url";

/** Absolute verify URL for the prefetch-safe activate click (top-level navigation). */
export function buildMagicLinkVerifyUrl(token: string, webOrigin?: string): string {
  const authBase = getAuthIssuerBaseUrl().replace(/\/$/, "");
  const webBase = (webOrigin?.trim() ? webOrigin : getSiteUrl()).replace(/\/$/, "");
  const url = new URL(`${authBase}/api/auth/magic-link/verify`);
  url.searchParams.set("token", token);
  url.searchParams.set("callbackURL", `${webBase}/auth/activate/set-password`);
  url.searchParams.set("errorCallbackURL", `${webBase}/auth/activate/expired`);
  return url.toString();
}
