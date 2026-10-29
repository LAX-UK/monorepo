import { OrgDocumentsStepClient } from "@/app/(task)/onboarding/organisation/step/documents/org-documents-step-client";
import { redirectIfOrgOnboardingStepBlocked } from "@/lib/data/http/org-onboarding-step-guard.server";
import { loadOrgDocumentSlots } from "@/lib/legal-entity/org-document-requirements.server";
import { orgOnboardingStepHref } from "@/lib/legal-entity/org-onboarding-resume";
import { redirect } from "next/navigation";

export default async function OrgOnboardingDocumentsStepPage({
  searchParams,
}: {
  searchParams: Promise<{ entityId?: string; fresh?: string }>;
}) {
  const sp = await searchParams;
  const fresh = sp.fresh === "1";
  const entityId = fresh ? undefined : sp.entityId;
  if (!entityId) {
    redirect("/onboarding/organisation/step/type");
  }

  const state = await redirectIfOrgOnboardingStepBlocked(entityId, "documents");
  const subkind = state.subkind;
  if (!subkind) redirect(orgOnboardingStepHref("type", { entityId }));

  const slots = await loadOrgDocumentSlots(subkind);
  if (!slots) redirect("/home");

  return (
    <OrgDocumentsStepClient
      entityId={entityId}
      fresh={fresh}
      slots={slots}
      subkind={subkind}
      uploadedDocuments={state.documents}
    />
  );
}
