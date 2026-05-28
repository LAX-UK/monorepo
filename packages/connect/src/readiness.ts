import { labelForRequirement } from "./requirement-labels.js";
import type {
  ConnectAccountStatus,
  ConnectGapOptions,
  ConnectGapState,
  ConnectLegalEntityFields,
} from "./types.js";

export function shouldSkipConnect(entity: Pick<ConnectLegalEntityFields, "isLaxManaged">): boolean {
  return entity.isLaxManaged === true;
}

/** Stripe side ready to receive transfers (webhook promotion, onboarding UI). */
export function isStripeAccountConfigured(entity: ConnectLegalEntityFields): boolean {
  if (shouldSkipConnect(entity)) return true;
  return (
    entity.stripeConnectPayoutsEnabled &&
    (entity.stripeConnectRequirementsCurrentlyDue ?? []).length === 0
  );
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
    chargesEnabled: false,
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
    return {
      stage: "managed_by_lax",
      missing: [],
      canReceivePayouts: true,
      canPublish: entity.status === "approved",
    };
  }

  if (entity.status === "restricted" || entity.status === "rejected") {
    return {
      stage: "restricted",
      missing: [],
      canReceivePayouts: false,
      canPublish: false,
    };
  }

  const disabledReason = entity.stripeConnectDisabledReason?.trim();
  if (disabledReason) {
    return {
      stage: "restricted",
      missing: [
        {
          key: "stripe_disabled",
          label: "Account restricted",
          hint: disabledReason,
          severity: "error",
        },
      ],
      canReceivePayouts: false,
      canPublish: false,
    };
  }

  const kycApproved = options.kycApproved ?? true;
  if (!kycApproved) {
    return {
      stage: "kyc_required",
      missing: [],
      canReceivePayouts: false,
      canPublish: false,
    };
  }

  if (!entity.stripeConnectAccountId) {
    return {
      stage: "not_started",
      missing: [],
      canReceivePayouts: false,
      canPublish: false,
    };
  }

  const due = entity.stripeConnectRequirementsCurrentlyDue ?? [];
  const missing = due.map((key) => {
    const label = labelForRequirement(key);
    return { key, ...label };
  });

  if (due.length > 0 || !entity.stripeConnectPayoutsEnabled) {
    return {
      stage: due.length > 0 ? "requirements_due" : "onboarding_incomplete",
      missing,
      canReceivePayouts: false,
      canPublish: false,
    };
  }

  return {
    stage: "ready",
    missing,
    canReceivePayouts: true,
    canPublish: isSellerConnectReady(entity),
  };
}
