import "server-only";

import { resolveRolloutFlag } from "@/lib/rollout/resolve-rollout-flag.server";

/**
 * Mirrors `resolveStrictBidEligibilityEnabled` in apps/api: an explicit flag
 * wins; otherwise the default follows APP_ENV so the web gate cannot drift
 * from the API gate. Do not switch this fallback to NODE_ENV.
 */
export function isStrictBidEligibilityEnabled(): boolean {
  return resolveRolloutFlag("STRICT_BID_ELIGIBILITY_ENABLED", process.env.APP_ENV !== "production");
}
