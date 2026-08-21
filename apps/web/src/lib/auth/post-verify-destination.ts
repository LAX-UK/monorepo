import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { fullBuyerOnboardingHref } from "@/lib/kyc/buyer-onboarding";
import { identityOnboardingHref } from "@/lib/kyc/identity-onboarding";

export type SignupPersona = "individual" | "organisation";

export type PostVerifyDestinationInput = {
  /** `?next=` from the email link / verify-email URL — wins when same-origin and safe. */
  requestedNext?: string | null;
  /** `?persona=` echoed by the signup hook (used before session is hydrated). */
  queryPersona?: string | null;
  /** Persona persisted on the user row, surfaced via /users/me. */
  sessionPersona?: SignupPersona | null;
  /** When false (production), organisation persona routes to dashboard. */
  orgModuleEnabled?: boolean;
  /** Server-resolved rollout flag for proactive individual identity onboarding. */
  identityOnboardingEnabled?: boolean;
  /** Independent rollout for the one-time interests → recommendations → KYC flow. */
  fullBuyerOnboardingEnabled?: boolean;
  categoryInterestsOnboardingCompletedAt?: string | Date | null;
};

export type PostVerifyDestination = {
  href: string;
  label: string;
};

function normalisePersona(value: string | null | undefined): SignupPersona | null {
  return value === "individual" || value === "organisation" ? value : null;
}

/** Choose the post-verify CTA target.
 *
 * Order:
 * 1. Persona from session (most authoritative — set in DB by Phase B).
 * 2. Persona echoed in the verify-email URL (fallback before session is hydrated).
 * 3. Resolve the eventual safe destination.
 * 4. When enabled, individual/default personas visit identity onboarding first.
 *
 * Organisation persona lands the user inside the onboarding wizard rather than
 * the dashboard so they can finish provisioning their entity before bidding.
 */
export function resolvePostVerifyDestination(
  input: PostVerifyDestinationInput,
): PostVerifyDestination {
  const persona = normalisePersona(input.sessionPersona) ?? normalisePersona(input.queryPersona);
  const orgModuleEnabled = input.orgModuleEnabled !== false;
  const requestedDestination = isSafeNextPath(input.requestedNext ?? undefined)
    ? (input.requestedNext as string)
    : null;

  if (persona === "organisation" && requestedDestination) {
    return { href: requestedDestination, label: "Continue" };
  }

  if (persona === "organisation" && orgModuleEnabled) {
    return { href: "/onboarding/organisation", label: "Set up your organisation" };
  }

  const eventualDestination = requestedDestination ?? "/dashboard";

  if (
    input.fullBuyerOnboardingEnabled === true &&
    persona === "individual" &&
    input.categoryInterestsOnboardingCompletedAt === null
  ) {
    return {
      href: fullBuyerOnboardingHref(eventualDestination),
      label: "Personalise your experience",
    };
  }

  if (input.identityOnboardingEnabled === true && persona !== "organisation") {
    return {
      href: identityOnboardingHref("why", eventualDestination, "post_verify"),
      label: "Set up identity verification",
    };
  }

  return {
    href: eventualDestination,
    label: eventualDestination === "/dashboard" ? "Go to dashboard" : "Continue",
  };
}
