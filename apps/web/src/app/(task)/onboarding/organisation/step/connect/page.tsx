import { OrgConnectStepClient } from "@/app/(task)/onboarding/organisation/step/connect/org-connect-step-client";
import { redirect } from "next/navigation";

export default async function OrgOnboardingConnectStepPage({
  searchParams,
}: {
  searchParams: Promise<{ entityId?: string; fresh?: string }>;
}) {
  const sp = await searchParams;
  const fresh = sp.fresh === "1";
  const entityId = fresh ? undefined : sp.entityId;
  if (!entityId) redirect("/onboarding/organisation/step/type");
  return <OrgConnectStepClient entityId={entityId} fresh={fresh} />;
}
