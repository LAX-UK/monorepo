import "server-only";

import { resolveRolloutFlag } from "@/lib/rollout/resolve-rollout-flag.server";

export function isFullBuyerOnboardingEnabled(): boolean {
  return resolveRolloutFlag("FULL_BUYER_ONBOARDING_ENABLED", process.env.NODE_ENV !== "production");
}
