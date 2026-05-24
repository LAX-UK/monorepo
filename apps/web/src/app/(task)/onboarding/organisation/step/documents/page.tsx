import {
  type DocumentSlot,
  OrgDocumentsStepClient,
} from "@/app/(task)/onboarding/organisation/step/documents/org-documents-step-client";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import type { PublicOrganisationSubkind } from "@auction/validators";
import { redirect } from "next/navigation";

const ESTATE_LABELS = ["Probate document", "Executor ID", "Beneficiary list"] as const;

const KIND_TITLES: Record<string, string> = {
  companies_house_extract: "Companies House extract",
  vat_certificate: "VAT certificate",
  beneficial_owner_id: "Beneficial owner ID",
  provenance_sample: "Provenance sample",
  bank_statement: "Bank statement",
  other: "Other document",
};

function slotsForSubkind(subkind: PublicOrganisationSubkind): DocumentSlot[] {
  if (subkind === "estate") {
    return ESTATE_LABELS.map((label) => ({
      kind: "other",
      label,
      title: label,
    }));
  }
  if (subkind === "other") {
    return [{ kind: "other", title: "Supporting document" }];
  }
  return [];
}

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

  const onb = await authedServerFetch(`/organizations/${entityId}/onboarding`, {
    cache: "no-store",
  });
  if (!onb.ok) redirect("/onboarding/organisation/step/type");
  const body = (await onb.json()) as {
    data?: { entity?: { subkind?: PublicOrganisationSubkind } };
  };
  const subkind = body.data?.entity?.subkind;
  if (!subkind) redirect("/onboarding/organisation/step/type");

  let slots = slotsForSubkind(subkind);
  if (slots.length === 0) {
    const reqRes = await authedServerFetch(`/organizations/requirements/${subkind}`, {
      cache: "no-store",
    });
    if (!reqRes.ok) redirect("/dashboard");
    const reqBody = (await reqRes.json()) as { data?: { documentKinds?: string[] } };
    const kinds = reqBody.data?.documentKinds ?? [];
    slots = kinds.map((k) => ({
      kind: k,
      title: KIND_TITLES[k] ?? k,
    }));
  }

  return <OrgDocumentsStepClient entityId={entityId} fresh={fresh} slots={slots} />;
}
