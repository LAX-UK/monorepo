import { OrgIdentityStepClient } from "@/app/(marketing)/onboarding/organisation/step/identity/org-identity-step-client";
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
  return <OrgIdentityStepClient entityId={entityId} fresh={fresh} />;
}
