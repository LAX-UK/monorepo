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
  const callbackUrl = new URL(buildMagicLinkSetPasswordCallbackUrl(webBase, safeNext));
  callbackUrl.searchParams.set("auth_method", "magic_link");
  url.searchParams.set("token", token);
  url.searchParams.set("callbackURL", callbackUrl.toString());
  url.searchParams.set("errorCallbackURL", buildMagicLinkExpiredCallbackUrl(webBase));
  return url.toString();
}
