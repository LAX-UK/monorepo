import { getAuthIssuerBaseUrl } from "@/lib/auth-client";
import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { getSiteUrl } from "@/lib/site-url";
import {
  buildMagicLinkExpiredCallbackUrl,
  buildMagicLinkSetPasswordCallbackUrl,
} from "@auction/auth/magic-link-callback";

/** Absolute verify URL for the prefetch-safe activate click (top-level navigation). */
export function buildMagicLinkVerifyUrl(
  token: string,
  webOrigin?: string,
  next?: string | null,
): string {
  const authBase = getAuthIssuerBaseUrl().replace(/\/$/, "");
  const webBase = (webOrigin?.trim() ? webOrigin : getSiteUrl()).replace(/\/$/, "");
  const safeNext = next && isSafeNextPath(next) ? next : undefined;
  const url = new URL(`${authBase}/api/auth/magic-link/verify`);
  const activationUrl = new URL(buildMagicLinkSetPasswordCallbackUrl(webBase, safeNext));
  activationUrl.searchParams.set("auth_method", "magic_link");
  const callbackUrl = new URL("/api/auth/login", webBase);
  callbackUrl.searchParams.set("next", `${activationUrl.pathname}${activationUrl.search}`);
  url.searchParams.set("token", token);
  url.searchParams.set("callbackURL", callbackUrl.toString());
  url.searchParams.set("errorCallbackURL", buildMagicLinkExpiredCallbackUrl(webBase));
  return url.toString();
}
