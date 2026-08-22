import { IdentityOnboardingVerifyClient } from "@/app/(task)/onboarding/identity/verify/identity-onboarding-verify-client";
import { IdentityOnboardingShell } from "@/components/kyc/identity-onboarding-shell";
import { getServerKycStatusSummary } from "@/lib/data/http/kyc.server";
import {
  resolveIdentityOnboardingNext,
  resolveIdentityOnboardingSource,
} from "@/lib/kyc/identity-onboarding";
import { redirect } from "next/navigation";

export default async function IdentityOnboardingVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; source?: string; kyc?: string }>;
}) {
  const params = await searchParams;
  const next = resolveIdentityOnboardingNext(params.next);
  const source = resolveIdentityOnboardingSource(params.source);
  const summary = await getServerKycStatusSummary();

  if (summary?.status === "approved") redirect(next);

  return (
    <IdentityOnboardingShell
      step="verify"
      source={source}
      title="One step from verified"
      description="Complete the secure Veriff document and selfie checks. You can finish later and resume without losing your place."
    >
      <IdentityOnboardingVerifyClient summary={summary} next={next} source={source} />
    </IdentityOnboardingShell>
  );
}
