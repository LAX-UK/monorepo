import "server-only";

import { headers } from "next/headers";

const IDENTITY_ONBOARDING_PREFIX = "/onboarding/identity";

/** Current identity-onboarding path + search, supplied by middleware. */
export async function resolveIdentityOnboardingRequestPath(): Promise<string> {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname");
  if (
    pathname !== IDENTITY_ONBOARDING_PREFIX &&
    !pathname?.startsWith(`${IDENTITY_ONBOARDING_PREFIX}/`)
  ) {
    return IDENTITY_ONBOARDING_PREFIX;
  }
  return `${pathname}${requestHeaders.get("x-search") ?? ""}`;
}
