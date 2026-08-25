import "server-only";

import { parseBooleanFlag } from "@/lib/rollout/parse-boolean-flag";
import { resolveStrictBidEligibilityRollout } from "@auction/domain";

/** Env adapter for the shared domain rollout. Do not switch APP_ENV to NODE_ENV. */
export function isStrictBidEligibilityEnabled(): boolean {
  return resolveStrictBidEligibilityRollout({
    appEnv: process.env.APP_ENV,
    enabled: parseBooleanFlag(process.env.STRICT_BID_ELIGIBILITY_ENABLED) ?? undefined,
  });
}
