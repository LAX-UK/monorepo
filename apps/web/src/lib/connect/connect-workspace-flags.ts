import { type ConnectGapState, isConnectOnboardingStage } from "@auction/connect";

function canOnboard(role: string): boolean {
  return role === "owner" || role === "admin";
}

export function deriveConnectWorkspaceFlags(input: {
  memberRole: string;
  gap: ConnectGapState;
  stripeActionRequired: number;
}): {
  canCompleteOnboarding: boolean;
  showOnboarding: boolean;
  showOnboardingForm: boolean;
  showManagement: boolean;
  showFinanceReadOnly: boolean;
  useCompactHeader: boolean;
} {
  const { memberRole, gap, stripeActionRequired } = input;
  const canCompleteOnboarding = canOnboard(memberRole);
  const showOnboarding = canCompleteOnboarding && isConnectOnboardingStage(gap.stage);
  const showManagement = gap.stage === "ready";
  const showFinanceReadOnly = !canCompleteOnboarding && gap.stage !== "ready";
  const stripeBannerActive = stripeActionRequired > 0;
  const useCompactHeader =
    showOnboarding && (stripeBannerActive || gap.stage === "requirements_due");

  return {
    canCompleteOnboarding,
    showOnboarding,
    showOnboardingForm: showOnboarding,
    showManagement,
    showFinanceReadOnly,
    useCompactHeader,
  };
}
