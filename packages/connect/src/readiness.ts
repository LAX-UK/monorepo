import {
  humanizeStripeDisabledReason,
  isActionableStripeDisabledReason,
} from "./disabled-reason-labels.js";
import { labelForRequirement } from "./requirement-labels.js";
import type {
  ConnectAccountStatus,
  ConnectGapMissingItem,
  ConnectGapOptions,
  ConnectGapStage,
  ConnectGapState,
  ConnectLegalEntityFields,
} from "./types.js";

export const CONNECT_ONBOARDING_STAGES = [
  "not_started",
  "onboarding_incomplete",
  "requirements_due",
] as const satisfies readonly ConnectGapStage[];

export function isConnectOnboardingStage(stage: ConnectGapStage): boolean {
  return (CONNECT_ONBOARDING_STAGES as readonly string[]).includes(stage);
}

export function isPastDueConnectGap(gap: ConnectGapState): boolean {
  return gap.disabledReason?.trim() === "requirements.past_due";
}

function withEntityDisabledReason(
  entity: ConnectLegalEntityFields,
  state: ConnectGapState,
): ConnectGapState {
  return {
    ...state,
    disabledReason: entity.stripeConnectDisabledReason?.trim() ?? null,
  };
}

function mapRequirementsToMissing(due: string[]): ConnectGapMissingItem[] {
  return due.map((key) => {
    const label = labelForRequirement(key);
    return { key, ...label };
  });
}

function requirementsDueGapState(missing: ConnectGapMissingItem[]): ConnectGapState {
  return {
    stage: "requirements_due",
    missing,
    canReceivePayouts: false,
    canPublish: false,
  };
}

export function shouldSkipConnect(entity: Pick<ConnectLegalEntityFields, "isLaxManaged">): boolean {
  return entity.isLaxManaged === true;
}

/** Stripe side ready to receive transfers (webhook promotion, onboarding UI). */
export function isStripeAccountConfigured(entity: ConnectLegalEntityFields): boolean {
  if (shouldSkipConnect(entity)) return true;

  const due = entity.stripeConnectRequirementsCurrentlyDue ?? [];
  const disabledReason = entity.stripeConnectDisabledReason?.trim();

  if (!entity.stripeConnectPayoutsEnabled || due.length > 0) return false;
  if (disabledReason) return false;

  return true;
}

/** Business gate for publish + settlement. */
export function isSellerConnectReady(entity: ConnectLegalEntityFields): boolean {
  if (shouldSkipConnect(entity)) return true;
  return entity.status === "approved" && isStripeAccountConfigured(entity);
}

export function statusFromLegalEntityRow(entity: ConnectLegalEntityFields): ConnectAccountStatus {
  const configured = isStripeAccountConfigured(entity);
  return {
    stripeAccountId: entity.stripeConnectAccountId ?? null,
    chargesEnabled: entity.stripeConnectChargesEnabled ?? false,
    payoutsEnabled: entity.stripeConnectPayoutsEnabled,
    requirementsCurrentlyDue: entity.stripeConnectRequirementsCurrentlyDue ?? [],
    disabledReason: entity.stripeConnectDisabledReason ?? null,
    ready: configured,
  };
}

export function getConnectGapState(
  entity: ConnectLegalEntityFields,
  options: ConnectGapOptions = {},
): ConnectGapState {
  if (shouldSkipConnect(entity)) {
    return withEntityDisabledReason(entity, {
      stage: "managed_by_lax",
      missing: [],
      canReceivePayouts: true,
      canPublish: entity.status === "approved",
    });
  }

  if (entity.status === "restricted" || entity.status === "rejected") {
    return withEntityDisabledReason(entity, {
      stage: "restricted",
      missing: [],
      canReceivePayouts: false,
      canPublish: false,
    });
  }

  const disabledReason = entity.stripeConnectDisabledReason?.trim();
  if (disabledReason) {
    const due = entity.stripeConnectRequirementsCurrentlyDue ?? [];
    if (isActionableStripeDisabledReason(disabledReason)) {
      const summary = humanizeStripeDisabledReason(disabledReason);
      const missing: ConnectGapMissingItem[] = [
        { key: "stripe_disabled", ...summary },
        ...mapRequirementsToMissing(due),
      ];
      return withEntityDisabledReason(entity, requirementsDueGapState(missing));
    }

    const summary = humanizeStripeDisabledReason(disabledReason);
    return withEntityDisabledReason(entity, {
      stage: "restricted",
      missing: [{ key: "stripe_disabled", ...summary }],
      canReceivePayouts: false,
      canPublish: false,
    });
  }

  const kycApproved = options.kycApproved ?? true;
  if (!kycApproved) {
    return withEntityDisabledReason(entity, {
      stage: "kyc_required",
      missing: [],
      canReceivePayouts: false,
      canPublish: false,
    });
  }

  if (!entity.stripeConnectAccountId) {
    return withEntityDisabledReason(entity, {
      stage: "not_started",
      missing: [],
      canReceivePayouts: false,
      canPublish: false,
    });
  }

  const due = entity.stripeConnectRequirementsCurrentlyDue ?? [];
  const missing = mapRequirementsToMissing(due);

  if (due.length > 0 || !entity.stripeConnectPayoutsEnabled) {
    return withEntityDisabledReason(entity, {
      stage: due.length > 0 ? "requirements_due" : "onboarding_incomplete",
      missing,
      canReceivePayouts: false,
      canPublish: false,
    });
  }

  return withEntityDisabledReason(entity, {
    stage: "ready",
    missing,
    canReceivePayouts: true,
    canPublish: isSellerConnectReady(entity),
  });
}
