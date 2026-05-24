"use client";

import { startKycVerification } from "@/app/dashboard/verify-identity/actions";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";
import {
  KycStatusPanel,
  type KycUiPhase,
  KycVerificationLauncher,
  kycInitialPhase,
} from "@/components/kyc";
import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { getSiteUrl } from "@/lib/site-url";
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
    if (searchParams.get("kyc") !== "complete") return;
    if (initialStatus?.feedback?.needsResubmit) {
      setPhase("needs_resubmit");
      return;
    }
    const trulySubmitted =
      initialStatus?.latestSessionStatus === "processing" ||
      (initialStatus?.status === "pending" && initialStatus.latestSessionStatus !== "created");
    if (trulySubmitted) setPhase("submitted");
  }, [
    initialStatus?.feedback?.needsResubmit,
    initialStatus?.latestSessionStatus,
    initialStatus?.status,
    searchParams,
  ]);

  useEffect(() => {
    setPhase(kycInitialPhase(initialStatus));
  }, [initialStatus]);

  useEffect(() => {
    if (initialStatus?.status !== "approved" || !safeNext) return;
    router.replace(safeNext);
  }, [initialStatus?.status, router, safeNext]);

  const returnUrl = `${getSiteUrl()}/dashboard/verify-identity?kyc=complete${safeNext ? `&next=${encodeURIComponent(safeNext)}` : ""}`;

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
