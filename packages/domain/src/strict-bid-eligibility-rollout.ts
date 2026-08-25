export type StrictBidEligibilityRolloutInput = {
  appEnv?: string | undefined;
  enabled?: boolean | undefined;
};

/**
 * One rollout policy for API, worker, and web.
 *
 * Production is opt-in. Non-production environments default on so the strict
 * path stays exercised unless a deployment explicitly disables it.
 */
export function resolveStrictBidEligibilityRollout({
  appEnv,
  enabled,
}: StrictBidEligibilityRolloutInput): boolean {
  return enabled ?? appEnv !== "production";
}
