import "server-only";

import {
  type ResolvePostAuthDestinationInput,
  resolvePostAuthDestination,
} from "@/lib/auth/post-auth-destination";
import { isFullBuyerOnboardingEnabled } from "@/lib/kyc/full-buyer-onboarding-rollout.server";

type ServerPostAuthDestinationInput = Omit<
  ResolvePostAuthDestinationInput,
  "fullBuyerOnboardingEnabled"
>;

export function resolveServerPostAuthDestination(input: ServerPostAuthDestinationInput): string {
  return resolvePostAuthDestination({
    ...input,
    fullBuyerOnboardingEnabled: isFullBuyerOnboardingEnabled(),
  });
}
