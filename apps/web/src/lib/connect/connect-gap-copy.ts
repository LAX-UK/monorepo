import { type ConnectGapStage, type ConnectGapState, isPastDueConnectGap } from "@auction/connect";
import type { StatusBadgeProps } from "@auction/ui/components/status-badge";

export function connectGapStageLabel(stage: ConnectGapStage): string {
  switch (stage) {
    case "managed_by_lax":
      return "Managed by LAX";
    case "not_started":
      return "Payout setup not started";
    case "kyc_required":
      return "Identity verification required";
    case "onboarding_incomplete":
      return "Payout setup incomplete";
    case "requirements_due":
      return "Action required";
    case "ready":
      return "Payout ready";
    case "restricted":
      return "Account restricted";
    default:
      return "Payout setup";
  }
}

export function connectGapStageBadgeVariant(
  stage: ConnectGapStage,
): NonNullable<StatusBadgeProps["variant"]> {
  switch (stage) {
    case "ready":
    case "managed_by_lax":
      return "success";
    case "requirements_due":
    case "onboarding_incomplete":
    case "not_started":
      return "warning";
    case "kyc_required":
      return "info";
    case "restricted":
      return "danger";
    default:
      return "neutral";
  }
}

export function connectGapStageSummary(
  stage: ConnectGapStage,
  _gap?: ConnectGapState,
  options?: { readOnly?: boolean },
): string {
  if (options?.readOnly) {
    return connectGapReadOnlySummary(stage);
  }

  switch (stage) {
    case "managed_by_lax":
      return "LAX manages payouts for this inventory — no Stripe Connect setup is required.";
    case "not_started":
      return "We'll set up a secure Stripe payout account, then you'll add bank details and verification below.";
    case "kyc_required":
      return "Complete identity verification before starting payout setup.";
    case "onboarding_incomplete":
      return "Finish payout setup in the secure form below so we can transfer your net proceeds.";
    case "requirements_due":
      return "Stripe needs a few details before we can send payouts. Complete the form below.";
    case "ready":
      return "Your payout account is ready — approved lots can be scheduled once finance enables settlement.";
    case "restricted":
      return "This payout account can't be used right now. Contact support@lax.bid for help.";
    default:
      return "Complete payout setup to receive transfers.";
  }
}

/** Summary for finance and other roles who cannot complete onboarding themselves. */
export function connectGapReadOnlySummary(stage: ConnectGapStage): string {
  switch (stage) {
    case "not_started":
      return "Payout setup has not started. Ask an organisation owner or admin to begin setup.";
    case "kyc_required":
      return "Identity verification is required before payout setup can begin. Ask an organisation owner or admin to complete it.";
    case "onboarding_incomplete":
    case "requirements_due":
      return "Payout setup is incomplete. Ask an organisation owner or admin to finish verification.";
    case "restricted":
      return "This payout account can't be used right now. Ask an organisation owner or admin to contact support@lax.bid for help.";
    default:
      return "Payout setup is incomplete. Ask an organisation owner or admin to finish setup.";
  }
}

/** Short hint shown under the status summary for in-progress setup stages. */
export function connectGapActionHint(
  stage: ConnectGapStage,
  options?: { readOnly?: boolean },
): string | null {
  if (options?.readOnly) return null;

  switch (stage) {
    case "not_started":
    case "onboarding_incomplete":
    case "requirements_due":
      return "Use the secure form below to update your details.";
    default:
      return null;
  }
}

export function connectGapPayoutsBannerCopy(gap: ConnectGapState): {
  title: string;
  description: string;
} {
  switch (gap.stage) {
    case "not_started":
      return {
        title: "Start payout setup",
        description: "Set up Stripe Connect to receive settlement transfers.",
      };
    case "kyc_required":
      return {
        title: "Verify identity first",
        description: "Complete identity verification before connecting a payout account.",
      };
    case "requirements_due":
      if (isPastDueConnectGap(gap)) {
        return {
          title: "Finish overdue payout details",
          description: "Stripe needs updated verification before we can send settlement transfers.",
        };
      }
      return {
        title: "Action required on payout setup",
        description: "Stripe needs a few details before we can send settlement transfers.",
      };
    case "onboarding_incomplete":
      return {
        title: "Finish payout setup",
        description: "Complete Stripe Connect verification to receive settlement transfers.",
      };
    case "restricted":
      return {
        title: "Payout account restricted",
        description:
          "This payout account can't receive transfers right now. Contact support@lax.bid for help.",
      };
    default:
      return {
        title: "Payout setup incomplete",
        description: "Finish Stripe Connect verification to receive settlement transfers.",
      };
  }
}

/** Count label for outstanding setup items (excludes duplicate summary rows). */
export function connectGapMissingCountLabel(gap: ConnectGapState): string | null {
  const actionableItems = gap.missing.filter((item) => item.key !== "stripe_disabled");
  const count = actionableItems.length > 0 ? actionableItems.length : gap.missing.length;
  if (count <= 0) return null;
  if (count === 1) return "1 detail needed";
  return `${count} details needed`;
}
