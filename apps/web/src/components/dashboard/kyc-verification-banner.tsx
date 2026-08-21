import { KYC_BANNER_DESCRIPTION, isKycAwaitingDecision } from "@/components/kyc";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { formatMoney } from "@/lib/format-currency";
import { dashboardIdentityOnboardingHref } from "@/lib/kyc/identity-onboarding";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import Link from "next/link";

type Props = {
  summary: KycStatusSummaryDto;
  proactive?: boolean;
  onboardingEnabled?: boolean;
};

export function KycVerificationBanner({
  summary,
  proactive = false,
  onboardingEnabled: _onboardingEnabled = false,
}: Props) {
  if (!summary.requiresKyc && !proactive) return null;
  const awaitingDecision = isKycAwaitingDecision(summary);
  const href = dashboardIdentityOnboardingHref();
  const exposure = formatMoney(
    summary.pendingExposure.total.toFixed(2),
    summary.pendingExposure.currency,
  );
  const threshold = formatMoney(summary.thresholdAmount.toFixed(2), summary.thresholdCurrency);
  return (
    <Alert className="border-outline-variant/40 bg-surface-container-low" data-testid="kyc-banner">
      <AlertTitle>
        {awaitingDecision
          ? "Identity verification in review"
          : proactive
            ? "Verify now for uninterrupted bidding"
            : "Identity verification required"}
      </AlertTitle>
      <AlertDescription className="text-pretty">
        {awaitingDecision ? (
          <>Veriff is reviewing your submission. You can return here to check your status.</>
        ) : proactive ? (
          <>
            Secure verification usually takes about two minutes. Complete it now, or return when you
            are ready.
          </>
        ) : (
          <>
            Your outstanding bids and commitments ({exposure}) meet our verification threshold (
            {threshold}). {KYC_BANNER_DESCRIPTION}
          </>
        )}
        <span className="mt-2 block">
          <Link className="font-medium underline underline-offset-2" href={href}>
            {awaitingDecision
              ? "View verification status"
              : proactive
                ? "Start identity setup"
                : "Verify identity"}
          </Link>
        </span>
      </AlertDescription>
    </Alert>
  );
}
