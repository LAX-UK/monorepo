"use client";

import {
  postOrgOnboardingStepCompleteAction,
  postOrgSubmitForReviewAction,
  startKycForOrganisationOnboardingAction,
} from "@/app/(marketing)/onboarding/organisation/onboarding-actions";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";
import {
  KycStatusPanel,
  type KycUiPhase,
  KycVerificationLauncher,
  kycInitialPhase,
} from "@/components/kyc";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { getSiteUrl } from "@/lib/site-url";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type Props = {
  entityId: string;
  kycSummary: KycStatusSummaryDto | null;
};

export function OrgIdentityStepClient({ entityId, kycSummary }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<KycUiPhase>(kycInitialPhase(kycSummary));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("kyc") !== "complete") return;
    if (kycSummary?.feedback?.needsResubmit) {
      setPhase("needs_resubmit");
      router.refresh();
      return;
    }
    const trulySubmitted =
      kycSummary?.latestSessionStatus === "processing" ||
      (kycSummary?.status === "pending" && kycSummary.latestSessionStatus !== "created");
    if (trulySubmitted) {
      setPhase("submitted");
      router.refresh();
    }
  }, [
    kycSummary?.feedback?.needsResubmit,
    kycSummary?.latestSessionStatus,
    kycSummary?.status,
    router,
    searchParams,
  ]);

  useEffect(() => {
    setPhase(kycInitialPhase(kycSummary));
  }, [kycSummary]);

  const kycApproved = kycSummary?.status === "approved";
  const returnUrl = `${getSiteUrl()}/onboarding/organisation/step/identity?entityId=${encodeURIComponent(entityId)}&kyc=complete`;

  const onSubmit = () => {
    setError(null);
    startTransition(async () => {
      const step = await postOrgOnboardingStepCompleteAction(entityId, "identity");
      if (!step.ok) {
        setError(step.error ?? "Could not save identity step.");
        return;
      }
      const sub = await postOrgSubmitForReviewAction(entityId);
      if (!sub.ok) {
        const extra = sub.missingSteps?.length ? ` Missing: ${sub.missingSteps.join(", ")}.` : "";
        setError((sub.error ?? "Submit failed") + extra);
        return;
      }
      router.push("/dashboard?org_submitted=1");
    });
  };

  return (
    <div className="space-y-6 px-4">
      <h2 className="text-xl font-semibold">Identity verification</h2>
      <p className="text-sm text-on-surface-variant">
        Complete identity verification for your user account, then submit your organisation for
        review. You must be verified before submission.
      </p>
      <KycStatusPanel summary={kycSummary} phase={phase} />
      {!kycApproved ? (
        <>
          {phase === "starting" ? (
            <div aria-live="polite" aria-busy="true" className="py-2">
              <DashboardSkeleton variant="list" />
            </div>
          ) : null}
          <KycVerificationLauncher
            returnUrl={returnUrl}
            kycSummary={kycSummary}
            onStartSession={async () => startKycForOrganisationOnboardingAction(entityId)}
            onPhaseChange={setPhase}
            onComplete={() => router.refresh()}
          />
        </>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !kycApproved}
          onClick={onSubmit}
        >
          Submit organisation for review
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard">Save and continue later</Link>
        </Button>
      </div>
    </div>
  );
}
