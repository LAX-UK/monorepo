import "server-only";

import {
  isNonProductionDeployment,
  resolveRolloutFlag,
} from "@/lib/rollout/resolve-rollout-flag.server";

export function isFullBuyerOnboardingEnabled(): boolean {
  return resolveRolloutFlag("FULL_BUYER_ONBOARDING_ENABLED", isNonProductionDeployment());
}
