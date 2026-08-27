import { isSafeNextPath } from "@/lib/auth/safe-next-path";
import {
  DEFAULT_IDENTITY_ONBOARDING_DESTINATION,
  resolveIdentityOnboardingNext,
} from "@/lib/kyc/identity-onboarding";
import { type UserRole, canAccessStaffAdminShell } from "@auction/types";

export const BUYER_INTERESTS_ONBOARDING_PATH = "/onboarding/interests";
export const BUYER_RECOMMENDATIONS_ONBOARDING_PATH = "/onboarding/recommendations";
export type FullBuyerOnboardingSource = "post_verify" | "sign_in_resume";

type BuyerOnboardingUser = {
  role: UserRole;
  suspended?: boolean;
  emailVerified?: boolean;
  signupPersona?: "individual" | "organisation" | null;
};

function isEligibleBuyer(user: BuyerOnboardingUser): boolean {
  return (
    user.suspended !== true &&
    user.emailVerified === true &&
    !canAccessStaffAdminShell(user.role) &&
    user.signupPersona !== "organisation"
  );
}

/**
 * The full interests → KYC flow is exclusive to a newly verified individual.
 * Existing users are migration-backfilled complete, and normal login never uses
 * this policy.
 */
export function shouldStartFullBuyerOnboardingAfterEmailVerification(input: {
  enabled: boolean;
  user: BuyerOnboardingUser & {
    categoryInterestsOnboardingCompletedAt?: string | Date | null;
  };
}): boolean {
  return (
    input.enabled &&
    input.user.signupPersona === "individual" &&
    input.user.categoryInterestsOnboardingCompletedAt === null &&
    isEligibleBuyer(input.user)
  );
}

/**
 * Login resumes the full interests flow only while onboarding is still incomplete.
 * Backfilled users always have a completion timestamp, so normal login reaches the
 * requested destination without repeating identity onboarding.
 */
export function shouldStartFullBuyerOnboardingAfterLogin(input: {
  enabled: boolean;
  user: BuyerOnboardingUser & {
    categoryInterestsOnboardingCompletedAt?: string | Date | null;
  };
}): boolean {
  return shouldStartFullBuyerOnboardingAfterEmailVerification(input);
}

export function fullBuyerOnboardingHref(
  next: string | null | undefined,
  source: FullBuyerOnboardingSource = "post_verify",
): string {
  const safeNext = isSafeNextPath(next) ? (next as string) : null;
  const destination =
    safeNext === BUYER_INTERESTS_ONBOARDING_PATH ||
    safeNext?.startsWith(`${BUYER_INTERESTS_ONBOARDING_PATH}/`) ||
    safeNext?.startsWith(`${BUYER_INTERESTS_ONBOARDING_PATH}?`)
      ? DEFAULT_IDENTITY_ONBOARDING_DESTINATION
      : resolveIdentityOnboardingNext(safeNext);
  const params = new URLSearchParams({ next: destination, source });
  return `${BUYER_INTERESTS_ONBOARDING_PATH}?${params.toString()}`;
}

export function buyerInterestsCompletionHref(
  next: string | null | undefined,
  hasSelectedInterests: boolean,
  source: FullBuyerOnboardingSource = "post_verify",
): string {
  const destination = resolveIdentityOnboardingNext(next);
  const params = new URLSearchParams({ next: destination, source });
  return hasSelectedInterests
    ? `/onboarding/recommendations?${params.toString()}`
    : `/onboarding/identity?${params.toString()}`;
}
