import "server-only";

import { headers } from "next/headers";

/** Current onboarding path + search for auth `loginNext` (set by middleware). */
export async function resolveOrgOnboardingLoginNext(
  fallback = "/onboarding/organisation",
): Promise<string> {
  const h = await headers();
  const pathname = h.get("x-pathname");
  if (!pathname?.startsWith("/onboarding/organisation")) {
    return fallback;
  }
  const search = h.get("x-search") ?? "";
  return `${pathname}${search}`;
}
