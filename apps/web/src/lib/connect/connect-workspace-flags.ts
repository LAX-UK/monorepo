import { type ConnectGapState, isConnectOnboardingStage } from "@auction/connect";

function canOnboard(role: string): boolean {
  return role === "owner" || role === "admin";
}

export function deriveConnectWorkspaceFlags(input: {
  memberRole: string;
  gap: ConnectGapState;
  stripeActionRequired: number;
  hasStripeAccount?: boolean;
}): {
  canCompleteOnboarding: boolean;
  showOnboarding: boolean;
  showOnboardingForm: boolean;
  showManagement: boolean;
  showFinanceReadOnly: boolean;
  showFinanceAwaitingOwner: boolean;
  showRefreshAction: boolean;
  showPreparingPanel: boolean;
  useCompactHeader: boolean;
} {
  const { memberRole, gap, stripeActionRequired, hasStripeAccount = false } = input;
  const canCompleteOnboarding = canOnboard(memberRole);
  const showOnboarding = canCompleteOnboarding && isConnectOnboardingStage(gap.stage);
  const showManagement = gap.stage === "ready";
  const showFinanceReadOnly = !canCompleteOnboarding && gap.stage !== "ready";
  const stripeBannerActive = stripeActionRequired > 0;
  const useCompactHeader =
    showOnboarding && (stripeBannerActive || gap.stage === "requirements_due");
  const showFinanceAwaitingOwner =
    showFinanceReadOnly &&
    !hasStripeAccount &&
    gap.stage !== "ready" &&
    gap.stage !== "managed_by_lax";
  const showRefreshAction = canCompleteOnboarding || (memberRole === "finance" && hasStripeAccount);
  const showPreparingPanel = canCompleteOnboarding && !hasStripeAccount;

  return {
    canCompleteOnboarding,
    showOnboarding,
    showOnboardingForm: showOnboarding,
    showManagement,
    showFinanceReadOnly,
    showFinanceAwaitingOwner,
    showRefreshAction,
    showPreparingPanel,
    useCompactHeader,
  };
}
