import type { LegalEntityStatus } from "@auction/types";
import type {
  LegalEntityDocumentUploadInput,
  PublicOrganisationSubkind,
} from "@auction/validators";
import {
  assertDocumentsCompleteForSubkind,
  assertEditableStatus,
  isOwnerOrAdmin,
} from "./org-onboarding-mappers.js";
import type { OrganizationOnboardingFlowDeps } from "./org-onboarding-types.js";

export async function attachDocument(
  deps: OrganizationOnboardingFlowDeps,
  userId: string,
  entityId: string,
  input: LegalEntityDocumentUploadInput,
): Promise<
  | { ok: true; id: string }
  | {
      ok: false;
      code:
        | "forbidden"
        | "upload_not_found"
        | "upload_not_ready"
        | "upload_kind_mismatch"
        | "duplicate_upload"
        | "other_document_label_required"
        | "entity_not_editable"
        | "not_found";
    }
> {
  const membership = await deps.legalEntityRepository.findActiveMembership(userId, entityId);
  if (!membership) return { ok: false, code: "forbidden" };
  if (!isOwnerOrAdmin(membership.role)) return { ok: false, code: "forbidden" };

  const entityRow = await deps.onboardingRepo.findOrganisationById(entityId);
  if (!entityRow || entityRow.kind !== "organisation") return { ok: false, code: "not_found" };
  if (!assertEditableStatus(entityRow.status as LegalEntityStatus)) {
    return { ok: false, code: "entity_not_editable" };
  }

  if (input.kind === "other") {
    const t = input.label?.trim() ?? "";
    if (!t) return { ok: false, code: "other_document_label_required" };
  }

  const upl = await deps.uploadPersistenceRepository.findByIdForOwner(input.uploadObjectId, userId);
  if (!upl) return { ok: false, code: "upload_not_found" };
  if (upl.kind !== "legal_entity_document") {
    return { ok: false, code: "upload_kind_mismatch" };
  }
  if (upl.status !== "active") {
    return { ok: false, code: "upload_not_ready" };
  }

  const dup = await deps.onboardingRepo.findDocumentByUploadObjectId(
    entityId,
    input.uploadObjectId,
  );
  if (dup) return { ok: false, code: "duplicate_upload" };

  const trimmedLabel = input.kind === "other" ? (input.label?.trim() ?? null) : null;

  const doc = await deps.onboardingRepo.attachOnboardingDocument({
    legalEntityId: entityId,
    uploadObjectId: input.uploadObjectId,
    kind: input.kind,
    label: input.kind === "other" ? trimmedLabel : null,
    uploadedByUserId: userId,
  });

  return { ok: true, id: doc.id };
}

export async function detachDocument(
  deps: OrganizationOnboardingFlowDeps,
  userId: string,
  entityId: string,
  documentId: string,
): Promise<
  | { ok: true }
  | { ok: false; code: "forbidden" | "not_found" | "document_not_found" | "entity_not_editable" }
> {
  const membership = await deps.legalEntityRepository.findActiveMembership(userId, entityId);
  if (!membership) return { ok: false, code: "forbidden" };
  if (!isOwnerOrAdmin(membership.role)) return { ok: false, code: "forbidden" };

  const entityRow = await deps.onboardingRepo.findOrganisationById(entityId);
  if (!entityRow || entityRow.kind !== "organisation") return { ok: false, code: "not_found" };
  if (!assertEditableStatus(entityRow.status as LegalEntityStatus)) {
    return { ok: false, code: "entity_not_editable" };
  }

  const doc = await deps.onboardingRepo.findOnboardingDocumentById(entityId, documentId);
  if (!doc) return { ok: false, code: "document_not_found" };

  await deps.onboardingRepo.detachOnboardingDocument(documentId);
  return { ok: true };
}

export async function assertDocumentsComplete(
  deps: OrganizationOnboardingFlowDeps,
  entityId: string,
  subkind: PublicOrganisationSubkind,
): Promise<boolean> {
  const docs = await deps.onboardingRepo.listDocuments(entityId);
  const reqs = deps.organizationOnboardingService.getRequirements(subkind);
  return assertDocumentsCompleteForSubkind(docs, subkind, reqs.documentKinds);
}
