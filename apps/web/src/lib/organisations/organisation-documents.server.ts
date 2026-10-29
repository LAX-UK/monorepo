import "server-only";

import { fetchOrgOnboardingState } from "@/lib/data/http/org-onboarding-step-guard.server";
import type { DocumentSlot } from "@/lib/legal-entity/org-document-requirements";
import { loadOrgDocumentSlots } from "@/lib/legal-entity/org-document-requirements.server";
import type { OrganisationDocumentRecord } from "@/lib/organisations/organisation-documents.vm";

export type OrganisationDocumentsLoad =
  | { ok: true; slots: DocumentSlot[]; received: OrganisationDocumentRecord[] }
  | { ok: false };

/** What LAX asked the organisation for and what it has sent, from the onboarding API. */
export async function loadOrganisationDocuments(
  entityId: string,
): Promise<OrganisationDocumentsLoad> {
  const state = await fetchOrgOnboardingState(entityId).catch(() => null);
  if (!state) return { ok: false };
  const slots = state.subkind ? await loadOrgDocumentSlots(state.subkind) : [];
  if (!slots) return { ok: false };
  return { ok: true, slots, received: state.documents };
}
