import { isStripeAccountConfigured } from "@auction/connect";
import type { OnboardingOrganisationRow } from "@auction/persistence";

export type ConnectStepFailureCode =
  | "connect_not_started"
  | "connect_not_complete"
  | "connect_requirements_pending"
  | "connect_restricted";

export function evaluateConnectStepReadiness(
  row: OnboardingOrganisationRow,
): { ok: true } | { ok: false; code: ConnectStepFailureCode } {
  if (!row.stripeConnectAccountId) {
    return { ok: false, code: "connect_not_started" };
  }

  const connectReady = isStripeAccountConfigured({
    stripeConnectAccountId: row.stripeConnectAccountId,
    stripeConnectPayoutsEnabled: row.stripeConnectPayoutsEnabled,
    stripeConnectRequirementsCurrentlyDue: row.stripeConnectRequirementsCurrentlyDue,
    stripeConnectDisabledReason: row.stripeConnectDisabledReason,
    isLaxManaged: row.isLaxManaged,
    status: row.status,
  });

  if (connectReady) {
    return { ok: true };
  }

  if ((row.stripeConnectRequirementsCurrentlyDue ?? []).length > 0) {
    return { ok: false, code: "connect_requirements_pending" };
  }

  if (row.stripeConnectDisabledReason?.trim()) {
    return { ok: false, code: "connect_restricted" };
  }

  return { ok: false, code: "connect_not_complete" };
}
