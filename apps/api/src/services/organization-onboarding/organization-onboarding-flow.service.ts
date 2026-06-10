import { isStripeAccountConfigured } from "@auction/connect";
import type { Database } from "@auction/db";
import {
  legalEntity,
  legalEntityAddress,
  legalEntityDocument,
  legalEntityOnboardingProgress,
  uploadObject,
  user,
} from "@auction/db/schema";
import {
  type LegalEntity,
  type LegalEntityStatus,
  ORG_ONBOARDING_STEPS,
  type OrgOnboardingStepKey,
} from "@auction/types";
import type {
  LegalEntityDocumentUploadInput,
  PublicOrganisationSubkind,
} from "@auction/validators";
import { and, eq, sql } from "drizzle-orm";
import {
  type LifecycleSelfOp,
  nextStatusForSelfOp,
} from "../../lib/legal-entity-lifecycle-self-transitions.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";
import type { IOrganizationOnboardingService } from "../interfaces/organization-onboarding.js";
import type { IConnectAccountSync, IConnectSessionProvider } from "../interfaces/stripe-connect.js";

const ESTATE_CANONICAL_LABELS = ["Probate document", "Executor ID", "Beneficiary list"] as const;

const EDITABLE_ORG_STATUSES = new Set<LegalEntityStatus>(["lead", "docs_requested"]);

function isOwnerOrAdmin(role: string): boolean {
  return role === "owner" || role === "admin";
}

export type OrganizationOnboardingFlowOptions = {
  onSubmittedForReview?: (args: {
    legalEntityId: string;
    displayName: string;
    actorUserId: string;
  }) => Promise<void>;
};

function rowToEntity(row: typeof legalEntity.$inferSelect): LegalEntity {
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

export class OrganizationOnboardingFlowService {
  constructor(
    private readonly db: Database,
    private readonly legalEntityRepository: ILegalEntityRepository,
    private readonly organizationOnboardingService: IOrganizationOnboardingService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly stripeConnect:
      | (IConnectAccountSync & Pick<IConnectSessionProvider, "isConfigured">)
      | null = null,
    private readonly options: OrganizationOnboardingFlowOptions = {},
  ) {}

  private assertEditableStatus(status: LegalEntityStatus): boolean {
    return EDITABLE_ORG_STATUSES.has(status);
  }

  async getOnboarding(
    userId: string,
    entityId: string,
  ): Promise<OrganizationOnboardingGetResult | null> {
    const membership = await this.legalEntityRepository.findActiveMembership(userId, entityId);
    if (!membership) return null;

    const rows = await this.db
      .select()
      .from(legalEntity)
      .where(eq(legalEntity.id, entityId))
      .limit(1);
    const row = rows[0];
    if (!row || row.kind !== "organisation") return null;

    const progressRows = await this.db
      .select({ stepKey: legalEntityOnboardingProgress.stepKey })
      .from(legalEntityOnboardingProgress)
      .where(eq(legalEntityOnboardingProgress.legalEntityId, entityId));

    const completedSteps = progressRows
      .map((r) => r.stepKey as OrgOnboardingStepKey)
      .filter((k) => (ORG_ONBOARDING_STEPS as readonly string[]).includes(k));

    const docRows = await this.db
      .select({
        id: legalEntityDocument.id,
        kind: legalEntityDocument.kind,
        label: legalEntityDocument.label,
        reviewStatus: legalEntityDocument.reviewStatus,
      })
      .from(legalEntityDocument)
      .where(eq(legalEntityDocument.legalEntityId, entityId));

    const addressRows = await this.db
      .select({
        addressType: legalEntityAddress.addressType,
        line1: legalEntityAddress.line1,
        line2: legalEntityAddress.line2,
        city: legalEntityAddress.city,
        state: legalEntityAddress.state,
        postalCode: legalEntityAddress.postalCode,
        country: legalEntityAddress.country,
        isDefault: legalEntityAddress.isDefault,
      })
      .from(legalEntityAddress)
      .where(
        and(
          eq(legalEntityAddress.legalEntityId, entityId),
          eq(legalEntityAddress.addressType, "registered_office"),
        ),
      )
      .limit(1);
    const addr = addressRows[0];

    return {
      entity: rowToEntity(row),
      completedSteps,
      documents: docRows,
      primaryAddress: addr
        ? {
            addressType: "registered_office",
            line1: addr.line1,
            line2: addr.line2 ?? null,
            city: addr.city,
            state: addr.state ?? null,
            postalCode: addr.postalCode,
            country: addr.country,
            isDefault: addr.isDefault ?? true,
          }
        : null,
    };
  }

  async updateProfile(
    userId: string,
    entityId: string,
    input: OrganizationOnboardingProfileInput,
  ): Promise<
    { ok: true } | { ok: false; code: "not_found" | "forbidden" | "entity_not_editable" }
  > {
    const membership = await this.legalEntityRepository.findActiveMembership(userId, entityId);
    if (!membership) return { ok: false, code: "forbidden" };
    if (!isOwnerOrAdmin(membership.role)) return { ok: false, code: "forbidden" };

    const rows = await this.db
      .select()
      .from(legalEntity)
      .where(eq(legalEntity.id, entityId))
      .limit(1);
    const row = rows[0];
    if (!row || row.kind !== "organisation") return { ok: false, code: "not_found" };
    if (!this.assertEditableStatus(row.status as LegalEntityStatus)) {
      return { ok: false, code: "entity_not_editable" };
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(legalEntity)
        .set({
          displayName: input.displayName,
          legalName: input.legalName?.trim() ? input.legalName.trim() : null,
          vatNumber: input.vatNumber?.trim() ? input.vatNumber.trim() : null,
          updatedAt: new Date(),
        })
        .where(eq(legalEntity.id, entityId));

      const existing = await tx
        .select({ id: legalEntityAddress.id })
        .from(legalEntityAddress)
        .where(
          and(
            eq(legalEntityAddress.legalEntityId, entityId),
            eq(legalEntityAddress.addressType, input.primaryAddress.addressType),
          ),
        )
        .limit(1);

      const addr = input.primaryAddress;
      if (existing[0]) {
        await tx
          .update(legalEntityAddress)
          .set({
            line1: addr.line1,
            line2: addr.line2 ?? null,
            city: addr.city,
            state: addr.state ?? null,
            postalCode: addr.postalCode,
            country: addr.country,
            isDefault: addr.isDefault ?? true,
          })
          .where(eq(legalEntityAddress.id, existing[0].id));
      } else {
        await tx.insert(legalEntityAddress).values({
          legalEntityId: entityId,
          addressType: addr.addressType,
          line1: addr.line1,
          line2: addr.line2 ?? null,
          city: addr.city,
          state: addr.state ?? null,
          postalCode: addr.postalCode,
          country: addr.country,
          isDefault: addr.isDefault ?? true,
        });
      }
    });

    return { ok: true };
  }

  async attachDocument(
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
    const membership = await this.legalEntityRepository.findActiveMembership(userId, entityId);
    if (!membership) return { ok: false, code: "forbidden" };
    if (!isOwnerOrAdmin(membership.role)) return { ok: false, code: "forbidden" };

    const [entityRow] = await this.db
      .select({ status: legalEntity.status, kind: legalEntity.kind })
      .from(legalEntity)
      .where(eq(legalEntity.id, entityId))
      .limit(1);
    if (!entityRow || entityRow.kind !== "organisation") return { ok: false, code: "not_found" };
    if (!this.assertEditableStatus(entityRow.status as LegalEntityStatus)) {
      return { ok: false, code: "entity_not_editable" };
    }

    if (input.kind === "other") {
      const t = input.label?.trim() ?? "";
      if (!t) return { ok: false, code: "other_document_label_required" };
    }

    const [upl] = await this.db
      .select()
      .from(uploadObject)
      .where(and(eq(uploadObject.id, input.uploadObjectId), eq(uploadObject.ownerUserId, userId)))
      .limit(1);
    if (!upl) return { ok: false, code: "upload_not_found" };
    if (upl.kind !== "legal_entity_document") {
      return { ok: false, code: "upload_kind_mismatch" };
    }
    if (upl.status !== "active") {
      return { ok: false, code: "upload_not_ready" };
    }

    const dup = await this.db
      .select({ id: legalEntityDocument.id })
      .from(legalEntityDocument)
      .where(
        and(
          eq(legalEntityDocument.legalEntityId, entityId),
          eq(legalEntityDocument.uploadObjectId, input.uploadObjectId),
        ),
      )
      .limit(1);
    if (dup[0]) return { ok: false, code: "duplicate_upload" };

    const trimmedLabel = input.kind === "other" ? (input.label?.trim() ?? null) : null;

    const [doc] = await this.db
      .insert(legalEntityDocument)
      .values({
        legalEntityId: entityId,
        uploadObjectId: input.uploadObjectId,
        kind: input.kind,
        label: input.kind === "other" ? trimmedLabel : null,
        uploadedByUserId: userId,
      })
      .returning({ id: legalEntityDocument.id });

    if (!doc) throw new Error("legal_entity_document_insert_failed");
    return { ok: true, id: doc.id };
  }

  async detachDocument(
    userId: string,
    entityId: string,
    documentId: string,
  ): Promise<
    | { ok: true }
    | { ok: false; code: "forbidden" | "not_found" | "document_not_found" | "entity_not_editable" }
  > {
    const membership = await this.legalEntityRepository.findActiveMembership(userId, entityId);
    if (!membership) return { ok: false, code: "forbidden" };
    if (!isOwnerOrAdmin(membership.role)) return { ok: false, code: "forbidden" };

    const [entityRow] = await this.db
      .select({ status: legalEntity.status, kind: legalEntity.kind })
      .from(legalEntity)
      .where(eq(legalEntity.id, entityId))
      .limit(1);
    if (!entityRow || entityRow.kind !== "organisation") return { ok: false, code: "not_found" };
    if (!this.assertEditableStatus(entityRow.status as LegalEntityStatus)) {
      return { ok: false, code: "entity_not_editable" };
    }

    const [doc] = await this.db
      .select({ id: legalEntityDocument.id })
      .from(legalEntityDocument)
      .where(
        and(
          eq(legalEntityDocument.id, documentId),
          eq(legalEntityDocument.legalEntityId, entityId),
        ),
      )
      .limit(1);
    if (!doc) return { ok: false, code: "document_not_found" };

    await this.db.delete(legalEntityDocument).where(eq(legalEntityDocument.id, documentId));
    return { ok: true };
  }

  async completeStep(
    userId: string,
    entityId: string,
    step: OrgOnboardingStepKey,
  ): Promise<
    | { ok: true }
    | {
        ok: false;
        code:
          | "not_found"
          | "forbidden"
          | "documents_incomplete"
          | "connect_not_started"
          | "connect_not_complete"
          | "connect_sync_failed"
          | "connect_requirements_pending"
          | "connect_restricted"
          | "type_incomplete"
          | "address_required"
          | "vat_required";
      }
  > {
    const membership = await this.legalEntityRepository.findActiveMembership(userId, entityId);
    if (!membership) return { ok: false, code: "forbidden" };
    if (membership.role !== "owner" && membership.role !== "admin") {
      return { ok: false, code: "forbidden" };
    }

    const rows = await this.db
      .select()
      .from(legalEntity)
      .where(eq(legalEntity.id, entityId))
      .limit(1);
    const row = rows[0];
    if (!row || row.kind !== "organisation") return { ok: false, code: "not_found" };

    const subkind = row.subkind as PublicOrganisationSubkind;

    if (step === "type") {
      if (!row.subkind) return { ok: false, code: "type_incomplete" };
    }

    if (step === "details") {
      if (!row.displayName?.trim()) return { ok: false, code: "address_required" };
      const addrOk = await this.assertRegisteredAddress(entityId);
      if (!addrOk) return { ok: false, code: "address_required" };
      const reqs = this.organizationOnboardingService.getRequirements(subkind);
      if (reqs.vatRequired && !row.vatNumber?.trim()) {
        return { ok: false, code: "vat_required" };
      }
    }

    if (step === "documents") {
      const okDocs = await this.assertDocumentsComplete(entityId, subkind);
      if (!okDocs) return { ok: false, code: "documents_incomplete" };
    }

    if (step === "connect") {
      if (this.stripeConnect?.isConfigured()) {
        try {
          await this.stripeConnect.syncAccountFromStripe(entityId);
        } catch {
          return { ok: false, code: "connect_sync_failed" };
        }
      }
      const refreshed = await this.db
        .select()
        .from(legalEntity)
        .where(eq(legalEntity.id, entityId))
        .limit(1);
      const connectRow = refreshed[0];
      if (!connectRow) return { ok: false, code: "not_found" };
      if (!connectRow.stripeConnectAccountId) {
        return { ok: false, code: "connect_not_started" };
      }
      const connectReady = isStripeAccountConfigured({
        stripeConnectAccountId: connectRow.stripeConnectAccountId,
        stripeConnectPayoutsEnabled: connectRow.stripeConnectPayoutsEnabled,
        stripeConnectRequirementsCurrentlyDue: connectRow.stripeConnectRequirementsCurrentlyDue,
        stripeConnectDisabledReason: connectRow.stripeConnectDisabledReason,
        isLaxManaged: connectRow.isLaxManaged,
        status: connectRow.status,
      });
      if (!connectReady) {
        if ((connectRow.stripeConnectRequirementsCurrentlyDue ?? []).length > 0) {
          return { ok: false, code: "connect_requirements_pending" };
        }
        if (connectRow.stripeConnectDisabledReason?.trim()) {
          return { ok: false, code: "connect_restricted" };
        }
        return { ok: false, code: "connect_not_complete" };
      }
    }

    await this.db
      .insert(legalEntityOnboardingProgress)
      .values({
        legalEntityId: entityId,
        stepKey: step,
        completedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          legalEntityOnboardingProgress.legalEntityId,
          legalEntityOnboardingProgress.stepKey,
        ],
        set: { completedAt: sql`excluded.completed_at` },
      });

    return { ok: true };
  }

  /** When completing `details`, also mark `type` if not yet recorded (subkind set at creation). */
  async completeDetailsWithType(
    userId: string,
    entityId: string,
  ): Promise<
    | { ok: true }
    | {
        ok: false;
        code:
          | "not_found"
          | "forbidden"
          | "documents_incomplete"
          | "type_incomplete"
          | "connect_not_started"
          | "connect_not_complete"
          | "connect_sync_failed"
          | "connect_requirements_pending"
          | "connect_restricted"
          | "address_required"
          | "vat_required";
      }
  > {
    const t = await this.completeStep(userId, entityId, "type");
    if (!t.ok) return t;
    return this.completeStep(userId, entityId, "details");
  }

  async submitForReview(userId: string, entityId: string): Promise<SubmitForReviewResult> {
    const membership = await this.legalEntityRepository.findActiveMembership(userId, entityId);
    if (!membership) return { ok: false, code: "forbidden" };
    if (!isOwnerOrAdmin(membership.role)) return { ok: false, code: "forbidden" };

    const rows = await this.db
      .select()
      .from(legalEntity)
      .where(eq(legalEntity.id, entityId))
      .limit(1);
    const row = rows[0];
    if (!row || row.kind !== "organisation") return { ok: false, code: "not_found" };

    const curStatus = row.status as LegalEntityStatus;
    const nav = nextStatusForSelfOp(curStatus, "submit_for_review");
    if (!nav) {
      return { ok: false, code: "invalid_transition" };
    }

    const progressRows = await this.db
      .select({ stepKey: legalEntityOnboardingProgress.stepKey })
      .from(legalEntityOnboardingProgress)
      .where(eq(legalEntityOnboardingProgress.legalEntityId, entityId));
    const done = new Set(progressRows.map((r) => r.stepKey));

    const missing = ORG_ONBOARDING_STEPS.filter((s) => !done.has(s));
    if (missing.length > 0) {
      return { ok: false, code: "onboarding_steps_incomplete", missingSteps: [...missing] };
    }

    const [u] = await this.db
      .select({ kycStatus: user.kycStatus })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (!u || u.kycStatus !== "approved") {
      return { ok: false, code: "user_identity_not_verified" };
    }

    if (done.has("connect") && this.stripeConnect?.isConfigured()) {
      try {
        await this.stripeConnect.syncAccountFromStripe(entityId);
      } catch {
        return { ok: false, code: "connect_sync_failed" };
      }
    }

    const op: LifecycleSelfOp = "submit_for_review";
    const txnResult = await this.db.transaction(async (tx) => {
      const locked = await tx
        .select()
        .from(legalEntity)
        .where(eq(legalEntity.id, entityId))
        .for("update")
        .limit(1);
      const cur = locked[0];
      if (!cur) return { ok: false as const, code: "not_found" as const };
      const curStatus = cur.status as LegalEntityStatus;
      const nav = nextStatusForSelfOp(curStatus, op);
      if (!nav) {
        return { ok: false as const, code: "invalid_transition" as const };
      }
      await tx
        .update(legalEntity)
        .set({
          status: nav,
          statusChangedAt: new Date(),
          statusChangedByUserId: userId,
          updatedAt: new Date(),
        })
        .where(eq(legalEntity.id, entityId));

      await this.domainEventPublisher.publish(tx, {
        aggregateType: "legal_entity",
        aggregateId: entityId,
        eventType: "legal_entity.lifecycle_progressed",
        payload: {
          trigger: "self_submit",
          from_status: curStatus,
          to_status: nav,
          kind: cur.kind,
        },
        actorUserId: userId,
        actingLegalEntityId: entityId,
      });

      return { ok: true as const, status: nav };
    });

    if (!txnResult || txnResult.ok === false) {
      return txnResult ?? { ok: false, code: "not_found" };
    }

    if (this.options.onSubmittedForReview) {
      await this.options.onSubmittedForReview({
        legalEntityId: entityId,
        displayName: row.displayName,
        actorUserId: userId,
      });
    }

    return { ok: true, status: txnResult.status };
  }

  private async assertRegisteredAddress(entityId: string): Promise<boolean> {
    const [a] = await this.db
      .select({ id: legalEntityAddress.id })
      .from(legalEntityAddress)
      .where(
        and(
          eq(legalEntityAddress.legalEntityId, entityId),
          eq(legalEntityAddress.addressType, "registered_office"),
        ),
      )
      .limit(1);
    return Boolean(a);
  }

  private async assertDocumentsComplete(
    entityId: string,
    subkind: PublicOrganisationSubkind,
  ): Promise<boolean> {
    const docs = await this.db
      .select({
        kind: legalEntityDocument.kind,
        label: legalEntityDocument.label,
      })
      .from(legalEntityDocument)
      .where(eq(legalEntityDocument.legalEntityId, entityId));

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

    const reqs = this.organizationOnboardingService.getRequirements(subkind);
    for (const kind of reqs.documentKinds) {
      const hit = docs.some((d) => d.kind === kind);
      if (!hit) return false;
    }
    return true;
  }
}
