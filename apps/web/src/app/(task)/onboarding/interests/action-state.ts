import type { FullBuyerOnboardingSource } from "@/lib/kyc/buyer-onboarding";

export type BuyerInterestsActionState = {
  error: string | null;
  redirectTo: string | null;
  submission: {
    skipped: boolean;
    selectedCount: number;
    source: FullBuyerOnboardingSource;
  } | null;
};

export const INITIAL_BUYER_INTERESTS_ACTION_STATE: BuyerInterestsActionState = {
  error: null,
  redirectTo: null,
  submission: null,
};
