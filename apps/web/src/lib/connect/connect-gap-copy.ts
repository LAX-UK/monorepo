import type { ConnectGapStage, ConnectGapState } from "@auction/connect";
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

export function connectGapStageSummary(stage: ConnectGapStage, gap?: ConnectGapState): string {
  switch (stage) {
    case "managed_by_lax":
      return "LAX manages payouts for this inventory — no Stripe Connect setup is required.";
    case "not_started":
      return "Create your payout account to receive settlement transfers after sales.";
    case "kyc_required":
      return "Complete identity verification before starting payout setup.";
    case "onboarding_incomplete":
      return "Finish Stripe Express onboarding so we can transfer your net proceeds.";
    case "requirements_due":
      return "Stripe still needs a few details before payouts can go out.";
    case "ready":
      return "Your payout account is ready — approved lots can be scheduled once finance enables settlement.";
    case "restricted":
      return gap?.missing[0]?.hint
        ? `This account has restrictions: ${gap.missing[0].hint}. Contact support for help.`
        : "This account has restrictions. Contact support for help.";
    default:
      return "Complete payout setup to receive transfers.";
  }
}
