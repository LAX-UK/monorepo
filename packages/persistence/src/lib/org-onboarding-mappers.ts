import type { legalEntity } from "@auction/db/schema";
import type { LegalEntity, LegalEntityStatus, OrgOnboardingStepKey } from "@auction/types";
import type { PublicOrganisationSubkind } from "@auction/validators";

export const ESTATE_CANONICAL_LABELS = [
  "Probate document",
  "Executor ID",
  "Beneficiary list",
] as const;

export const EDITABLE_ORG_STATUSES = new Set<LegalEntityStatus>(["lead", "docs_requested"]);

export function isOwnerOrAdmin(role: string): boolean {
  return role === "owner" || role === "admin";
}

export function assertEditableStatus(status: LegalEntityStatus): boolean {
  return EDITABLE_ORG_STATUSES.has(status);
}

export function rowToEntity(row: typeof legalEntity.$inferSelect): LegalEntity {
  return {
    id: row.id,
    displayName: row.displayName,
    legalName: row.legalName ?? null,
    slug: row.slug ?? null,
    kind: row.kind,
    subkind: row.subkind,
    createdByUserId: row.createdByUserId,
    status: row.status,
    statusChangedAt: row.statusChangedAt ?? null,
    statusChangedByUserId: row.statusChangedByUserId ?? null,
    statusReason: row.statusReason ?? null,
    stripeConnectAccountId: row.stripeConnectAccountId ?? null,
    stripeCustomerId: row.stripeCustomerId ?? null,
    stripeConnectChargesEnabled: row.stripeConnectChargesEnabled,
    stripeConnectPayoutsEnabled: row.stripeConnectPayoutsEnabled,
    stripeConnectRequirementsCurrentlyDue: row.stripeConnectRequirementsCurrentlyDue ?? [],
    stripeConnectRequirementsErrors: row.stripeConnectRequirementsErrors ?? [],
    stripeConnectDisabledReason: row.stripeConnectDisabledReason ?? null,
    xeroContactId: row.xeroContactId ?? null,
    vatNumber: row.vatNumber ?? null,
    marginSchemeEligible: row.marginSchemeEligible,
    isLaxManaged: row.isLaxManaged,
    platformFeeBps: row.platformFeeBps ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type OrganizationOnboardingDocumentDto = {
  id: string;
  kind: string;
  label: string | null;
  reviewStatus: string;
};

export type OrganizationOnboardingGetResult = {
  entity: LegalEntity;
  completedSteps: OrgOnboardingStepKey[];
  documents: OrganizationOnboardingDocumentDto[];
  primaryAddress: OrganizationOnboardingProfileInput["primaryAddress"] | null;
};

export type SubmitForReviewResult =
  | { ok: true; status: LegalEntityStatus }
  | {
      ok: false;
      code: "onboarding_steps_incomplete";
      missingSteps: OrgOnboardingStepKey[];
    }
  | { ok: false; code: "user_identity_not_verified" }
  | { ok: false; code: "invalid_transition" }
  | { ok: false; code: "not_found" }
  | { ok: false; code: "forbidden" }
  | { ok: false; code: "connect_sync_failed" }
  | { ok: false; code: "vat_required" }
  | { ok: false; code: "entity_not_editable" };

export type OrganizationOnboardingProfileInput = {
  displayName: string;
  legalName?: string | null;
  vatNumber?: string | null;
  primaryAddress: {
    addressType: "registered_office" | "collection" | "returns" | "billing" | "both";
    line1: string;
    line2?: string | null;
    city: string;
    state?: string | null;
    postalCode: string;
    country: string;
    isDefault?: boolean | null;
  };
};

export type OrganizationOnboardingFlowOptions = {
  onSubmittedForReview?: (args: {
    legalEntityId: string;
    displayName: string;
    actorUserId: string;
  }) => Promise<void>;
};

export function assertDocumentsCompleteForSubkind(
  docs: Array<{ kind: string; label: string | null }>,
  subkind: PublicOrganisationSubkind,
  documentKinds: readonly string[],
): boolean {
  if (subkind === "estate") {
    for (const label of ESTATE_CANONICAL_LABELS) {
      const hit = docs.some((d) => d.kind === "other" && (d.label?.trim() ?? "") === label);
      if (!hit) return false;
    }
    return true;
  }

  if (subkind === "other") {
    return docs.some((d) => d.kind === "other" && (d.label?.trim() ?? "").length > 0);
  }

  for (const kind of documentKinds) {
    const hit = docs.some((d) => d.kind === kind);
    if (!hit) return false;
  }
  return true;
}
