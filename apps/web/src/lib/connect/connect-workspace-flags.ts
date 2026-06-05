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
  showEmbeddedPanels: boolean;
  showRestrictedPanel: boolean;
  showFinanceReadOnly: boolean;
  showFinanceAwaitingOwner: boolean;
  showRefreshAction: boolean;
  showPreparingPanel: boolean;
  useCompactHeader: boolean;
} {
  const { memberRole, gap, stripeActionRequired, hasStripeAccount = false } = input;
  const canCompleteOnboarding = canOnboard(memberRole);
  const showOnboarding = canCompleteOnboarding && isConnectOnboardingStage(gap.stage);
  const showFinanceManagement =
    memberRole === "finance" &&
    hasStripeAccount &&
    gap.stage !== "ready" &&
    gap.stage !== "restricted";
  const showManagement = gap.stage === "ready" || showFinanceManagement;
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
  const showEmbeddedPanels = showOnboarding || showManagement;
  const showRestrictedPanel = hasStripeAccount && gap.stage === "restricted";

  return {
    canCompleteOnboarding,
    showOnboarding,
    showOnboardingForm: showOnboarding,
    showManagement,
    showEmbeddedPanels,
    showRestrictedPanel,
    showFinanceReadOnly,
    showFinanceAwaitingOwner,
    showRefreshAction,
    showPreparingPanel,
    useCompactHeader,
  };
}
