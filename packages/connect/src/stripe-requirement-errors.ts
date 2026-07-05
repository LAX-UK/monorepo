import {
  type StripeConnectRequirementError,
  type StripeConnectRequirementsView,
  normalizeStripeConnectRequirementErrors,
} from "@auction/types";
import { labelForRequirement } from "./requirement-labels.js";
import type { ConnectRequirementLabel } from "./types.js";

/** @deprecated Import `normalizeStripeConnectRequirementErrors` from `@auction/types`. */
export const normalizeStripeRequirementErrors = normalizeStripeConnectRequirementErrors;

export function mergeRequirementKeys(
  currentlyDue: readonly string[],
  errors: readonly StripeConnectRequirementError[],
): string[] {
  const keys = new Set<string>();
  for (const key of currentlyDue) {
    const trimmed = key.trim();
    if (trimmed) keys.add(trimmed);
  }
  for (const error of errors) {
    const trimmed = error.requirement.trim();
    if (trimmed) keys.add(trimmed);
  }
  return [...keys];
}

export function connectRequirementsAttentionCount(
  currentlyDue: readonly string[] | null | undefined,
  errors: readonly StripeConnectRequirementError[] | null | undefined,
): number {
  return mergeRequirementKeys(currentlyDue ?? [], errors ?? []).length;
}

function matchingErrorsForKey(
  requirementKey: string,
  errors: readonly StripeConnectRequirementError[],
): StripeConnectRequirementError[] {
  const normalizedKey = requirementKey.trim();
  return errors.filter((error) => error.requirement.trim() === normalizedKey);
}

export function resolveRequirementPresentation(
  requirementKey: string,
  errors: readonly StripeConnectRequirementError[] = [],
): ConnectRequirementLabel {
  const label = labelForRequirement(requirementKey);
  const matching = matchingErrorsForKey(requirementKey, errors);
  const stripeReason = matching
    .map((error) => error.reason.trim())
    .filter(Boolean)
    .join(" ");
  if (!stripeReason) return label;
  return {
    ...label,
    hint: stripeReason,
  };
}

export function buildConnectRequirementsView(
  currentlyDue: readonly string[] | null | undefined,
  errors: readonly StripeConnectRequirementError[] | null | undefined,
): StripeConnectRequirementsView {
  return {
    currentlyDue: [...(currentlyDue ?? [])],
    errors: [...(errors ?? [])],
  };
}
