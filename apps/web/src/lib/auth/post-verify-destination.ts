import { isSafeNextPath } from "@/lib/auth/post-auth-destination";

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
 * 1. Same-origin `?next=` wins (lets us preserve "you tried to do X" intent).
 * 2. Persona from session (most authoritative — set in DB by Phase B).
 * 3. Persona echoed in the verify-email URL (fallback before session is hydrated).
 * 4. Default `/dashboard`.
 *
 * Organisation persona lands the user inside the onboarding wizard rather than
 * the dashboard so they can finish provisioning their entity before bidding.
 */
export function resolvePostVerifyDestination(
  input: PostVerifyDestinationInput,
): PostVerifyDestination {
  if (isSafeNextPath(input.requestedNext ?? undefined)) {
    return { href: input.requestedNext as string, label: "Continue" };
  }

  const persona = normalisePersona(input.sessionPersona) ?? normalisePersona(input.queryPersona);
  const orgModuleEnabled = input.orgModuleEnabled !== false;

  if (persona === "organisation" && orgModuleEnabled) {
    return { href: "/onboarding/organisation", label: "Set up your organisation" };
  }

  return { href: "/dashboard", label: "Go to dashboard" };
}
