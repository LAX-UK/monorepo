import { OrgDetailsStepClient } from "@/app/(task)/onboarding/organisation/step/details/org-details-step-client";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import type { PublicOrganisationSubkind } from "@auction/validators";
import { redirect } from "next/navigation";

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
  if (entityId) {
    const res = await authedServerFetch(`/legal-entities/${entityId}`, { cache: "no-store" });
    if (res.ok) {
      const body = (await res.json()) as {
        data?: { displayName?: string; legalName?: string | null; vatNumber?: string | null };
      };
      initialDisplayName = body.data?.displayName ?? "";
      initialLegalName = body.data?.legalName ?? "";
      initialVat = body.data?.vatNumber ?? "";
    }
  }

  return (
    <OrgDetailsStepClient
      {...(entityId ? { entityId } : {})}
      {...(subkind ? { subkind } : {})}
      fresh={fresh}
      initialDisplayName={initialDisplayName}
      initialLegalName={initialLegalName}
      initialVat={initialVat}
    />
  );
}
