"use client";

import { startKycVerification } from "@/app/dashboard/verify-identity/actions";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";
import {
  KycStatusPanel,
  type KycUiPhase,
  KycVerificationLauncher,
  isKycSessionContinuable,
  kycInitialPhase,
  resolveIdentityVerifyClientPhase,
} from "@/components/kyc";
import { TrackedIdentityOnboardingLink } from "@/components/kyc/identity-onboarding-tracking";
import { trackKycOnboarding } from "@/lib/analytics/events";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { normalizeKycReturnUrl } from "@/lib/kyc";
import {
  type IdentityOnboardingSource,
  identityOnboardingHref,
} from "@/lib/kyc/identity-onboarding";
import { resolveIdentityVerifySkipLabel } from "@/lib/kyc/identity-onboarding-presentation";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  summary: KycStatusSummaryDto | null;
  next: string;
  source: IdentityOnboardingSource;
};

export function IdentityOnboardingVerifyClient({ summary, next, source }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<KycUiPhase>(() => kycInitialPhase(summary));
  const trackedPhases = useRef(new Set<KycUiPhase>());
  const submittedStorageKey = summary?.latestSessionId
    ? `@kyc-onboarding-submitted:${summary.latestSessionId}`
    : null;
  const skipLabel = resolveIdentityVerifySkipLabel(source);
  const returnUrl = normalizeKycReturnUrl(
    `${identityOnboardingHref("verify", next, source)}&kyc=complete`,
  );

  const trackPhase = useCallback(
    (nextPhase: KycUiPhase) => {
      if (trackedPhases.current.has(nextPhase)) return;
      if (
        nextPhase === "submitted" &&
        submittedStorageKey &&
        sessionStorage.getItem(submittedStorageKey) === "1"
      ) {
        trackedPhases.current.add(nextPhase);
        return;
      }
      trackedPhases.current.add(nextPhase);

      if (nextPhase === "in_flow") {
        trackKycOnboarding({
          event: isKycSessionContinuable(summary)
            ? "kyc_onboarding_resumed"
            : "kyc_onboarding_started",
          step: "verify",
          source,
        });
      }
      if (nextPhase === "submitted") {
        if (submittedStorageKey) sessionStorage.setItem(submittedStorageKey, "1");
        trackKycOnboarding({
          event: "kyc_onboarding_submitted",
          step: "verify",
          source,
        });
      }
    },
    [source, submittedStorageKey, summary],
  );

  const onPhaseChange = useCallback(
    (nextPhase: KycUiPhase) => {
      setPhase(nextPhase);
      trackPhase(nextPhase);
    },
    [trackPhase],
  );

  useEffect(() => {
    const returnedFromProvider = searchParams.get("kyc") === "complete";
    setPhase((current) => {
      const next = resolveIdentityVerifyClientPhase({
        summary,
        returnedFromProvider,
        currentPhase: current,
      });
      if (next === "submitted") trackPhase("submitted");
      return next;
    });
  }, [searchParams, summary, trackPhase]);

  return (
    <>
      <div className="mx-auto max-w-xl space-y-4">
        <KycStatusPanel summary={summary} phase={phase} />
        {phase === "starting" ? (
          <div aria-live="polite" aria-busy="true" className="py-2">
            <DashboardSkeleton variant="list" />
          </div>
        ) : null}
        <KycVerificationLauncher
          returnUrl={returnUrl}
          kycSummary={summary}
          onStartSession={startKycVerification}
          onPhaseChange={onPhaseChange}
          onComplete={() => router.refresh()}
          buttonLabel={
            isKycSessionContinuable(summary) ? "Resume verification" : "Start verification"
          }
          className="flex justify-center"
        />
      </div>
      <div className="mx-auto mt-10 flex max-w-4xl flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost">
          <Link href={identityOnboardingHref("why", next, source)}>Back</Link>
        </Button>
        {skipLabel ? (
          <Button asChild variant="ghost">
            <TrackedIdentityOnboardingLink
              href={next}
              event="kyc_onboarding_skip"
              step="verify"
              source={source}
            >
              {skipLabel}
            </TrackedIdentityOnboardingLink>
          </Button>
        ) : null}
      </div>
    </>
  );
}
