import { OrgDetailsStepClient } from "@/app/(task)/onboarding/organisation/step/details/org-details-step-client";
import { redirectIfOrgOnboardingStepBlocked } from "@/lib/data/http/org-onboarding-step-guard.server";
import type { CreateOrganizationInput, PublicOrganisationSubkind } from "@auction/validators";
import { redirect } from "next/navigation";

type Address = NonNullable<CreateOrganizationInput["primaryAddress"]>;

export default async function OrgOnboardingDetailsStepPage({
  searchParams,
}: {
  searchParams: Promise<{ entityId?: string; fresh?: string; subkind?: string }>;
}) {
  const sp = await searchParams;
  const fresh = sp.fresh === "1";
  const entityId = fresh ? undefined : sp.entityId;
  const subkind =
    typeof sp.subkind === "string" ? (sp.subkind as PublicOrganisationSubkind) : undefined;

  if (!entityId && !subkind) {
    redirect("/onboarding/organisation/step/type");
  }

  let initialDisplayName = "";
  let initialLegalName = "";
  let initialVat = "";
  let initialAddress: Address | undefined;
  let resolvedSubkind = subkind;

  if (entityId) {
    const state = await redirectIfOrgOnboardingStepBlocked(entityId, "details");
    initialDisplayName = state.displayName;
    initialLegalName = state.legalName;
    initialVat = state.vatNumber;
    resolvedSubkind = state.subkind ?? resolvedSubkind;
    if (state.primaryAddress) {
      initialAddress = state.primaryAddress;
    }
  }

  return (
    <OrgDetailsStepClient
      {...(entityId ? { entityId } : {})}
      {...(resolvedSubkind ? { subkind: resolvedSubkind } : {})}
      fresh={fresh}
      initialDisplayName={initialDisplayName}
      initialLegalName={initialLegalName}
      initialVat={initialVat}
      {...(initialAddress ? { initialAddress } : {})}
    />
  );
}
