import "server-only";

import {
  type ResolvePostAuthDestinationInput,
  resolvePostAuthDestination,
} from "@/lib/auth/post-auth-destination";
import { isFullBuyerOnboardingEnabled } from "@/lib/kyc/full-buyer-onboarding-rollout.server";
import { isIdentityOnboardingEnabled } from "@/lib/kyc/identity-onboarding-rollout.server";

type ServerPostAuthDestinationInput = Omit<
  ResolvePostAuthDestinationInput,
  "identityOnboardingEnabled" | "fullBuyerOnboardingEnabled"
>;

export function resolveServerPostAuthDestination(input: ServerPostAuthDestinationInput): string {
  return resolvePostAuthDestination({
    ...input,
    identityOnboardingEnabled: isIdentityOnboardingEnabled(),
    fullBuyerOnboardingEnabled: isFullBuyerOnboardingEnabled(),
  });
}
