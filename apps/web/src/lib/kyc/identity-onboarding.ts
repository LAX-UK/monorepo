import { isSafeNextPath } from "@/lib/auth/safe-next-path";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";

export const IDENTITY_ONBOARDING_PATH = "/onboarding/identity";
export const DEFAULT_IDENTITY_ONBOARDING_DESTINATION = "/dashboard";

export const IDENTITY_ONBOARDING_STEPS = [
  { id: "why", label: "Why verify", estimatedMinutes: 1 },
  { id: "verify", label: "Verify", estimatedMinutes: 2 },
] as const;

export type IdentityOnboardingStep = (typeof IDENTITY_ONBOARDING_STEPS)[number]["id"];
export type ContextualIdentitySource =
  | "bid_gate"
  | "registration"
  | "telephone"
  | "condition_report";

export type IdentityOnboardingSource =
  | "post_verify"
  | "sign_in_resume"
  | "sign_in"
  | "dashboard"
  | "direct"
  | ContextualIdentitySource;

export type IdentityOnboardingContext = {
  step?: IdentityOnboardingStep;
  next?: string | null | undefined;
  source?: IdentityOnboardingSource;
  lotId?: string | null | undefined;
};

const STEP_PATHS: Record<IdentityOnboardingStep, string> = {
  why: IDENTITY_ONBOARDING_PATH,
  verify: `${IDENTITY_ONBOARDING_PATH}/verify`,
};

export function resolveIdentityOnboardingNext(next: string | null | undefined): string {
  if (!isSafeNextPath(next)) return DEFAULT_IDENTITY_ONBOARDING_DESTINATION;
  const safeNext = next as string;
  if (
    safeNext === IDENTITY_ONBOARDING_PATH ||
    safeNext.startsWith(`${IDENTITY_ONBOARDING_PATH}/`)
  ) {
    return DEFAULT_IDENTITY_ONBOARDING_DESTINATION;
  }
  return safeNext;
}

export function buildIdentityOnboardingHref(context: IdentityOnboardingContext = {}): string {
  const step = context.step ?? "why";
  const destination = resolveIdentityOnboardingNext(context.next);
  const source = context.source ?? "direct";
  const params = new URLSearchParams({ next: destination, source });
  if (context.lotId) params.set("lot", context.lotId);
  return `${STEP_PATHS[step]}?${params.toString()}`;
}

export function identityOnboardingHref(
  step: IdentityOnboardingStep,
  next: string | null | undefined,
  source: IdentityOnboardingSource = "direct",
  lotId?: string | null,
): string {
  return buildIdentityOnboardingHref({ step, next, source, lotId });
}

export function contextualIdentityOnboardingHref(
  next: string | null | undefined,
  source: ContextualIdentitySource,
  lotId?: string | null,
): string {
  return buildIdentityOnboardingHref({ step: "why", next, source, lotId });
}

export function dashboardIdentityOnboardingHref(
  next: string | null | undefined = "/dashboard",
): string {
  return identityOnboardingHref("why", next, "dashboard");
}

export function legacyKycVerificationHref(next: string | null | undefined): string {
  const destination = resolveIdentityOnboardingNext(next);
  return `/dashboard/verify-identity?${new URLSearchParams({ next: destination }).toString()}`;
}

export function resolveIdentityOnboardingSource(
  source: string | null | undefined,
): IdentityOnboardingSource {
  return source === "post_verify" ||
    source === "sign_in_resume" ||
    source === "sign_in" ||
    source === "dashboard" ||
    source === "bid_gate" ||
    source === "registration" ||
    source === "telephone" ||
    source === "condition_report"
    ? source
    : "direct";
}

export function shouldOfferIdentityOnboarding(input: {
  enabled: boolean;
  summary: KycStatusSummaryDto | null;
  signupPersona?: "individual" | "organisation" | null | undefined;
}): boolean {
  return (
    input.enabled &&
    input.signupPersona !== "organisation" &&
    input.summary != null &&
    input.summary.status !== "approved"
  );
}
