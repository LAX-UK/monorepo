import "server-only";

import { headers } from "next/headers";

const BUYER_ONBOARDING_PREFIXES = ["/onboarding/interests", "/onboarding/recommendations"] as const;

/** Current buyer-onboarding path + search, supplied by middleware. */
export async function resolveBuyerOnboardingRequestPath(): Promise<string> {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname");
  const prefix = BUYER_ONBOARDING_PREFIXES.find(
    (candidate) => pathname === candidate || pathname?.startsWith(`${candidate}/`),
  );
  if (!pathname || !prefix) return "/onboarding/interests";
  return `${pathname}${requestHeaders.get("x-search") ?? ""}`;
}
