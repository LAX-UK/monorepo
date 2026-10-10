import type { AccessMarker, TwoFactorPolicy } from "./ports/two-factor-policy-store.js";
import { type SilverAcrStep, decideSilverAcrStep } from "./silver-acr-step.js";

export type TwoFactorRequirementSource =
  | { scope: "staff" }
  | { scope: "org"; legalEntityId: string };

export type TwoFactorRequirement = {
  required: boolean;
  sources: TwoFactorRequirementSource[];
};

/**
 * Applied when no policy row exists. Staff keep the pre-policy behaviour (required);
 * organisations opt in.
 */
export const TWO_FACTOR_POLICY_DEFAULTS = { staff: true, org: false } as const;
const STAFF_REQUIRED_BY_DEFAULT = TWO_FACTOR_POLICY_DEFAULTS.staff;

export function resolveTwoFactorRequirement(input: {
  markers: readonly AccessMarker[];
  policies: readonly TwoFactorPolicy[];
}): TwoFactorRequirement {
  const sources: TwoFactorRequirementSource[] = [];
  if (input.markers.some((marker) => marker.kind === "staff")) {
    const staffPolicy = input.policies.find((policy) => policy.scope === "staff");
    if (staffPolicy?.required ?? STAFF_REQUIRED_BY_DEFAULT) sources.push({ scope: "staff" });
  }
  const requiredOrgs = new Set(
    input.policies.flatMap((policy) =>
      policy.scope === "org" && policy.required ? [policy.legalEntityId] : [],
    ),
  );
  const seenOrgs = new Set<string>();
  for (const marker of input.markers) {
    if (marker.kind !== "org_member" || seenOrgs.has(marker.legalEntityId)) continue;
    seenOrgs.add(marker.legalEntityId);
    if (requiredOrgs.has(marker.legalEntityId)) {
      sources.push({ scope: "org", legalEntityId: marker.legalEntityId });
    }
  }
  return { required: sources.length > 0, sources };
}

/**
 * Decides the authorize-time step. A Silver request always needs TOTP/backup-code
 * completion; a policy requirement is also satisfied by a social sign-in.
 */
export function decideAuthorizeTwoFactorStep(input: {
  requestsSilver: boolean;
  requiredByPolicy: boolean;
  mfaCompletedAt: Date | null | undefined;
  socialAuthAt: Date | null | undefined;
  twoFactorEnabled: boolean;
  canEnrolTotp: boolean;
}): SilverAcrStep {
  if (input.mfaCompletedAt) return "pass";
  if (!input.requestsSilver) {
    if (!input.requiredByPolicy || input.socialAuthAt) return "pass";
  }
  return decideSilverAcrStep(input);
}
