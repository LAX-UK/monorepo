import { getSiteUrl } from "@/lib/site-url";

/** Absolute URL required by POST /kyc/session (`z.string().url()`). Accepts paths with query strings. */
export function normalizeKycReturnUrl(returnUrl: string): string {
  if (/^https?:\/\//i.test(returnUrl)) return returnUrl;
  const path = returnUrl.startsWith("/") ? returnUrl : `/${returnUrl}`;
  return `${getSiteUrl()}${path}`;
}
