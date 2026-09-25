"use client";

import { isSafeNextPath } from "@/lib/auth/post-auth-destination";

/** Redirect browser to account onboarding when the API returns `onboarding_required`. */
export function redirectForOnboardingRequired(code: string | null | undefined): boolean {
  if (code !== "onboarding_required" || typeof window === "undefined") return false;
  const path = `${window.location.pathname}${window.location.search}`;
  const next = isSafeNextPath(path) ? path : "/dashboard";
  window.location.assign(`/onboarding/account?next=${encodeURIComponent(next)}`);
  return true;
}
