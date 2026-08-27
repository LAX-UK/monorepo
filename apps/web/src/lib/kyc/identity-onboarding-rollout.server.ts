import "server-only";

import { resolveRolloutFlag } from "@/lib/rollout/resolve-rollout-flag.server";

/**
 * Ships enabled in local/test environments and dark in production until the
 * production smoke test and cohort rollout are complete.
 */
export function isIdentityOnboardingEnabled(): boolean {
  return resolveRolloutFlag("KYC_ONBOARDING_ENABLED", process.env.NODE_ENV !== "production");
}
