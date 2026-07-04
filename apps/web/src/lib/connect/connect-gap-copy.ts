import { type ConnectGapStage, type ConnectGapState, isPastDueConnectGap } from "@auction/connect";
import type { StatusBadgeProps } from "@auction/ui/components/status-badge";
import { connectGapStageCopy } from "./connect-gap-stage-registry";

export function connectGapStageLabel(stage: ConnectGapStage): string {
  return connectGapStageCopy(stage).label;
}

export function connectGapStageBadgeVariant(
  stage: ConnectGapStage,
): NonNullable<StatusBadgeProps["variant"]> {
  return connectGapStageCopy(stage).badgeVariant;
}

export function connectGapStageSummary(
  stage: ConnectGapStage,
  _gap?: ConnectGapState,
  options?: { readOnly?: boolean },
): string {
  const copy = connectGapStageCopy(stage);
  if (options?.readOnly) {
    return connectGapReadOnlySummary(stage);
  }
  return copy.summary;
}

/** Summary for finance and other roles who cannot complete onboarding themselves. */
export function connectGapReadOnlySummary(stage: ConnectGapStage): string {
  return connectGapStageCopy(stage).readOnlySummary;
}

/** Short hint shown under the status summary for in-progress setup stages. */
export function connectGapActionHint(
  stage: ConnectGapStage,
  options?: { readOnly?: boolean },
): string | null {
  if (options?.readOnly) return null;
  return connectGapStageCopy(stage).actionHint;
}

export function connectGapPayoutsBannerCopy(gap: ConnectGapState): {
  title: string;
  description: string;
} {
  switch (gap.stage) {
    case "not_started":
      return {
        title: "Start payout setup",
        description: "Set up your payout account to receive settlement transfers.",
      };
    case "kyc_required":
      return {
        title: "Verify identity first",
        description: "Complete identity verification before starting payout setup.",
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
        description: "Complete payout verification to receive settlement transfers.",
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
        description: "Finish payout verification to receive settlement transfers.",
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
