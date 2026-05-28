import { OrgIdentityStepClient } from "@/app/(task)/onboarding/organisation/step/identity/org-identity-step-client";
import { getServerKycStatusSummary } from "@/lib/data/http/kyc.server";
import { redirectIfOrgOnboardingStepBlocked } from "@/lib/data/http/org-onboarding-step-guard.server";
import { redirect } from "next/navigation";

export default async function OrgOnboardingIdentityStepPage({
  searchParams,
}: {
  searchParams: Promise<{ entityId?: string; fresh?: string }>;
}) {
  const sp = await searchParams;
  const fresh = sp.fresh === "1";
  const entityId = fresh ? undefined : sp.entityId;
  if (!entityId) redirect("/onboarding/organisation/step/type");
  await redirectIfOrgOnboardingStepBlocked(entityId, "identity");
  const kycSummary = await getServerKycStatusSummary();
  return <OrgIdentityStepClient entityId={entityId} kycSummary={kycSummary} />;
}
