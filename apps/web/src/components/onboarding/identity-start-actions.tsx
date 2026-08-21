"use client";

import { startKycVerification } from "@/app/dashboard/verify-identity/actions";
import { KycVerificationLauncher } from "@/components/kyc";
import { canStartKycVerification, kycInitialPhase } from "@/components/kyc/kyc-copy";
import {
  onboardingActions,
  onboardingPrimaryButton,
  onboardingTextButton,
} from "@/components/onboarding/buyer-onboarding-shell";
import { trackKycOnboarding } from "@/lib/analytics/events";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { normalizeKycReturnUrl } from "@/lib/kyc";
import {
  type IdentityOnboardingSource,
  identityOnboardingHref,
} from "@/lib/kyc/identity-onboarding";
import {
  resolveIdentitySkipLabel,
  resolveIdentityStartButtonLabel,
} from "@/lib/kyc/identity-onboarding-presentation";
import Link from "next/link";

type Props = {
  summary: KycStatusSummaryDto | null;
  next: string;
  source: IdentityOnboardingSource;
};

export function IdentityStartActions({ summary, next, source }: Props) {
  const returnUrl = normalizeKycReturnUrl(
    `${identityOnboardingHref("verify", next, source)}&kyc=complete`,
  );
  const phase = kycInitialPhase(summary);
  const canStart = canStartKycVerification(summary, phase);
  const buttonLabel = resolveIdentityStartButtonLabel(source, summary);
  const skipLabel = resolveIdentitySkipLabel(source);

  if (!canStart) {
    return (
      <div className="flex w-full justify-end">
        <Link href={next} className={`${onboardingPrimaryButton} w-full sm:w-auto`}>
          Continue
        </Link>
      </div>
    );
  }

  return (
    <div className={onboardingActions}>
      {skipLabel ? (
        <Link
          href={next}
          className={onboardingTextButton}
          onClick={() => trackKycOnboarding({ event: "kyc_onboarding_skip", step: "why", source })}
        >
          {skipLabel}
        </Link>
      ) : null}
      <KycVerificationLauncher
        returnUrl={returnUrl}
        kycSummary={summary}
        onStartSession={startKycVerification}
        buttonLabel={buttonLabel}
        buttonClassName={`${onboardingPrimaryButton} w-full sm:w-auto`}
      />
    </div>
  );
}
