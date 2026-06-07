"use client";

import { startKycVerification } from "@/app/dashboard/verify-identity/actions";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";
import {
  KycStatusPanel,
  type KycUiPhase,
  KycVerificationLauncher,
  isKycAwaitingDecision,
  kycInitialPhase,
} from "@/components/kyc";
import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { normalizeKycReturnUrl } from "@/lib/kyc";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Props = {
  initialStatus: import("@/lib/data/dto/dashboard-dtos").KycStatusSummaryDto | null;
};

export function VerifyIdentityClient({ initialStatus }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<KycUiPhase>(kycInitialPhase(initialStatus));

  const nextPath = searchParams.get("next");
  const safeNext = nextPath && isSafeNextPath(nextPath) ? nextPath : null;

  useEffect(() => {
    if (searchParams.get("kyc") === "complete") {
      if (initialStatus?.feedback?.needsResubmit) {
        setPhase("needs_resubmit");
        return;
      }
      if (isKycAwaitingDecision(initialStatus)) {
        setPhase("submitted");
        return;
      }
    }
    setPhase(kycInitialPhase(initialStatus));
  }, [initialStatus, searchParams]);

  useEffect(() => {
    if (initialStatus?.status !== "approved" || !safeNext) return;
    const timer = window.setTimeout(() => router.replace(safeNext), 1500);
    return () => window.clearTimeout(timer);
  }, [initialStatus?.status, router, safeNext]);

  if (initialStatus?.status === "approved" && safeNext) {
    return (
      <KycStatusPanel
        summary={initialStatus}
        phase="approved"
        className="border-success/30 bg-success-container/20"
      />
    );
  }

  const returnUrl = normalizeKycReturnUrl(
    `/dashboard/verify-identity?kyc=complete${safeNext ? `&next=${encodeURIComponent(safeNext)}` : ""}`,
  );

  const onStartSession = useCallback(async (url: string) => startKycVerification(url), []);

  const onComplete = useCallback(() => {
    router.refresh();
  }, [router]);

  if (initialStatus?.status === "approved") {
    return <KycStatusPanel summary={initialStatus} phase="approved" />;
  }

  return (
    <div className="max-w-lg space-y-4">
      <KycStatusPanel summary={initialStatus} phase={phase} />
      {phase === "starting" ? (
        <div aria-live="polite" aria-busy="true" className="py-2">
          <DashboardSkeleton variant="list" />
        </div>
      ) : null}
      <KycVerificationLauncher
        returnUrl={returnUrl}
        kycSummary={initialStatus}
        onStartSession={onStartSession}
        onPhaseChange={setPhase}
        onComplete={onComplete}
      />
    </div>
  );
}
