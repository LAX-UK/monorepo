import type { AdminTechnicalIdItem } from "@/components/admin/admin-technical-id-disclosure";
import type { StaffFacingRef } from "@/lib/admin/staff-facing-ref";
import {
  connectRequirementsAttentionCount,
  formatStripeConnectAccountForStaff,
  humanizeStripeDisabledReason,
  labelForRequirement,
  mergeRequirementKeys,
  resolveRequirementPresentation,
} from "@auction/connect";
import type { LegalEntity, StripeConnectRequirementError } from "@auction/types";

export function presentStripeConnectAccount(
  accountId: string | null | undefined,
): StaffFacingRef | null {
  const trimmed = accountId?.trim();
  if (!trimmed) return null;

  const formatted = formatStripeConnectAccountForStaff(trimmed);
  return {
    primary: formatted.primary,
    ...(formatted.secondary ? { secondary: formatted.secondary } : {}),
    technicalValue: formatted.rawId,
    copyLabel: "Stripe Connect account ID",
  };
}

export function presentStripeRequirement(
  key: string,
  errors: readonly StripeConnectRequirementError[] = [],
): StaffFacingRef {
  const label = resolveRequirementPresentation(key, errors);
  return {
    primary: label.label,
    secondary: label.hint,
    technicalValue: key,
    copyLabel: "Stripe requirement key",
  };
}

export function presentStripeRequirementsForEntity(
  entity: Pick<
    LegalEntity,
    "stripeConnectRequirementsCurrentlyDue" | "stripeConnectRequirementsErrors"
  >,
): StaffFacingRef[] {
  const errors = entity.stripeConnectRequirementsErrors ?? [];
  const keys = mergeRequirementKeys(entity.stripeConnectRequirementsCurrentlyDue, errors);
  return keys.map((key) => presentStripeRequirement(key, errors));
}

export function stripeRequirementsAttentionCountForEntity(
  entity: Pick<
    LegalEntity,
    "stripeConnectRequirementsCurrentlyDue" | "stripeConnectRequirementsErrors"
  >,
): number {
  return connectRequirementsAttentionCount(
    entity.stripeConnectRequirementsCurrentlyDue,
    entity.stripeConnectRequirementsErrors,
  );
}

export function presentStripeDisabledReason(
  code: string | null | undefined,
): StaffFacingRef | null {
  const trimmed = code?.trim();
  if (!trimmed) return null;

  const label = humanizeStripeDisabledReason(trimmed);
  return {
    primary: label.label,
    secondary: label.hint,
    technicalValue: trimmed,
    copyLabel: "Stripe disabled reason code",
  };
}

export function collectStripeTechnicalIds(
  entity: Pick<
    LegalEntity,
    | "stripeConnectAccountId"
    | "stripeConnectRequirementsCurrentlyDue"
    | "stripeConnectRequirementsErrors"
    | "stripeConnectDisabledReason"
  >,
): AdminTechnicalIdItem[] {
  const items: AdminTechnicalIdItem[] = [];

  const accountId = entity.stripeConnectAccountId?.trim();
  if (accountId) {
    items.push({
      label: "Stripe Connect account ID",
      value: accountId,
      copyLabel: "Stripe Connect account ID",
    });
  }

  const errors = entity.stripeConnectRequirementsErrors ?? [];
  const requirementKeys = mergeRequirementKeys(
    entity.stripeConnectRequirementsCurrentlyDue,
    errors,
  );
  for (const key of requirementKeys) {
    items.push({
      label: labelForRequirement(key).label,
      value: key,
      copyLabel: "Stripe requirement key",
    });
  }

  for (const error of errors) {
    items.push({
      label: `Error code (${labelForRequirement(error.requirement).label})`,
      value: error.code,
      copyLabel: "Stripe requirement error code",
    });
  }

  const disabledReason = entity.stripeConnectDisabledReason?.trim();
  if (disabledReason) {
    items.push({
      label: "Disabled reason code",
      value: disabledReason,
      copyLabel: "Stripe disabled reason code",
    });
  }

  return items;
}
