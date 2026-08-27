import { isSafeNextPath } from "@/lib/auth/safe-next-path";
import { isSellerSubmissionPath } from "@/lib/auth/seller-submission-path";
import type { SessionUser } from "@/lib/data/contracts";
import {
  fullBuyerOnboardingHref,
  shouldStartFullBuyerOnboardingAfterLogin,
} from "@/lib/kyc/buyer-onboarding";
import {
  type UserRole,
  canAccessStaffAdminShell,
  staffRoleDefaultDestination,
} from "@auction/types";

export type PostAuthContext = "sign-in" | "sign-up" | "redirect-if-authed" | "verify-email-success";

export type ResolvePostAuthDestinationInput = {
  user: Pick<
    SessionUser,
    | "role"
    | "staffRole"
    | "suspended"
    | "emailVerified"
    | "email"
    | "kycStatus"
    | "signupPersona"
    | "categoryInterestsOnboardingCompletedAt"
  >;
  requestedNext?: string | null | undefined;
  context: PostAuthContext;
  /** When true, unverified users are sent to verify-pending for sign-up / redirect-if-authed contexts. */
  requireEmailVerification?: boolean;
  /** Server-resolved rollout flag for the one-time interests onboarding flow. */
  fullBuyerOnboardingEnabled?: boolean;
  /** Append `welcome=back` to the destination query string. */
  withWelcomeBack?: boolean;
};

export { isSafeNextPath } from "@/lib/auth/safe-next-path";

function appendWelcomeBack(path: string, withWelcomeBack: boolean): string {
  if (!withWelcomeBack) return path;
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}welcome=back`;
}

/** Central post-auth navigation for web (server guards, middleware heuristic, client after sign-in).
 */
export function resolvePostAuthDestination(input: ResolvePostAuthDestinationInput): string {
  const {
    user,
    requestedNext,
    context,
    requireEmailVerification = false,
    fullBuyerOnboardingEnabled = false,
    withWelcomeBack = false,
  } = input;

  if (user.suspended === true) {
    return appendWelcomeBack("/account-suspended", withWelcomeBack);
  }

  const needsEmailGate =
    requireEmailVerification &&
    user.emailVerified !== true &&
    (context === "sign-up" || context === "redirect-if-authed");

  if (needsEmailGate) {
    const q = new URLSearchParams();
    if (isSafeNextPath(requestedNext ?? undefined)) {
      q.set("next", requestedNext as string);
    }
    const qs = q.toString();
    return appendWelcomeBack(
      qs ? `/register/verify-pending?${qs}` : "/register/verify-pending",
      withWelcomeBack,
    );
  }

  const role = user.role as UserRole;
  const isStaff = canAccessStaffAdminShell(role);
  const requestedIsClientHome =
    requestedNext === "/dashboard" || (requestedNext?.startsWith("/dashboard/") ?? false);
  const requestedIsSellerSubmission =
    requestedNext != null && isSellerSubmissionPath(requestedNext);

  const eventualDestination =
    isSafeNextPath(requestedNext ?? undefined) &&
    !(isStaff && requestedIsClientHome && !requestedIsSellerSubmission)
      ? (requestedNext as string)
      : staffRoleDefaultDestination(role, user.staffRole ?? null);
  const destination = appendWelcomeBack(eventualDestination, withWelcomeBack);

  if (
    shouldStartFullBuyerOnboardingAfterLogin({
      enabled: fullBuyerOnboardingEnabled,
      user,
    })
  ) {
    return fullBuyerOnboardingHref(destination, "sign_in_resume");
  }

  return destination;
}
