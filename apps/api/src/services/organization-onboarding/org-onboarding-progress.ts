import { isStripeAccountConfigured } from "@auction/connect";
import {
  legalEntity,
  legalEntityAddress,
  legalEntityDocument,
  legalEntityOnboardingProgress,
  user,
} from "@auction/db/schema";
import {
  type LegalEntityStatus,
  ORG_ONBOARDING_STEPS,
  type OrgOnboardingStepKey,
} from "@auction/types";
import type { PublicOrganisationSubkind } from "@auction/validators";
import { and, eq, sql } from "drizzle-orm";
import {
  type LifecycleSelfOp,
  nextStatusForSelfOp,
} from "../../lib/legal-entity-lifecycle-self-transitions.js";
import { assertDocumentsComplete } from "./org-onboarding-documents.js";
import {
  type OrganizationOnboardingGetResult,
  type OrganizationOnboardingProfileInput,
  type SubmitForReviewResult,
  assertEditableStatus,
  isOwnerOrAdmin,
  rowToEntity,
} from "./org-onboarding-mappers.js";
import type { OrganizationOnboardingFlowDeps } from "./org-onboarding-types.js";

export async function getOnboarding(
  deps: OrganizationOnboardingFlowDeps,
  userId: string,
  entityId: string,
): Promise<OrganizationOnboardingGetResult | null> {
  const membership = await deps.legalEntityRepository.findActiveMembership(userId, entityId);
  if (!membership) return null;

  const rows = await deps.db
    .select()
    .from(legalEntity)
    .where(eq(legalEntity.id, entityId))
    .limit(1);
  const row = rows[0];
  if (!row || row.kind !== "organisation") return null;

  const progressRows = await deps.db
    .select({ stepKey: legalEntityOnboardingProgress.stepKey })
    .from(legalEntityOnboardingProgress)
    .where(eq(legalEntityOnboardingProgress.legalEntityId, entityId));

  const completedSteps = progressRows
    .map((r) => r.stepKey as OrgOnboardingStepKey)
    .filter((k) => (ORG_ONBOARDING_STEPS as readonly string[]).includes(k));

  const docRows = await deps.db
    .select({
      id: legalEntityDocument.id,
      kind: legalEntityDocument.kind,
      label: legalEntityDocument.label,
      reviewStatus: legalEntityDocument.reviewStatus,
    })
    .from(legalEntityDocument)
    .where(eq(legalEntityDocument.legalEntityId, entityId));

  const addressRows = await deps.db
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

export async function updateProfile(
  deps: OrganizationOnboardingFlowDeps,
  userId: string,
  entityId: string,
  input: OrganizationOnboardingProfileInput,
): Promise<{ ok: true } | { ok: false; code: "not_found" | "forbidden" | "entity_not_editable" }> {
  const membership = await deps.legalEntityRepository.findActiveMembership(userId, entityId);
  if (!membership) return { ok: false, code: "forbidden" };
  if (!isOwnerOrAdmin(membership.role)) return { ok: false, code: "forbidden" };

  const rows = await deps.db
    .select()
    .from(legalEntity)
    .where(eq(legalEntity.id, entityId))
    .limit(1);
  const row = rows[0];
  if (!row || row.kind !== "organisation") return { ok: false, code: "not_found" };
  if (!assertEditableStatus(row.status as LegalEntityStatus)) {
    return { ok: false, code: "entity_not_editable" };
  }

  await deps.db.transaction(async (tx) => {
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

export async function completeStep(
  deps: OrganizationOnboardingFlowDeps,
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
  const membership = await deps.legalEntityRepository.findActiveMembership(userId, entityId);
  if (!membership) return { ok: false, code: "forbidden" };
  if (membership.role !== "owner" && membership.role !== "admin") {
    return { ok: false, code: "forbidden" };
  }

  const rows = await deps.db
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
    const addrOk = await assertRegisteredAddress(deps, entityId);
    if (!addrOk) return { ok: false, code: "address_required" };
    const reqs = deps.organizationOnboardingService.getRequirements(subkind);
    if (reqs.vatRequired && !row.vatNumber?.trim()) {
      return { ok: false, code: "vat_required" };
    }
  }

  if (step === "documents") {
    const okDocs = await assertDocumentsComplete(deps, entityId, subkind);
    if (!okDocs) return { ok: false, code: "documents_incomplete" };
  }

  if (step === "connect") {
    if (deps.stripeConnect?.isConfigured()) {
      try {
        await deps.stripeConnect.syncAccountFromStripe(entityId);
      } catch {
        return { ok: false, code: "connect_sync_failed" };
      }
    }
    const refreshed = await deps.db
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

  await deps.db
    .insert(legalEntityOnboardingProgress)
    .values({
      legalEntityId: entityId,
      stepKey: step,
      completedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [legalEntityOnboardingProgress.legalEntityId, legalEntityOnboardingProgress.stepKey],
      set: { completedAt: sql`excluded.completed_at` },
    });

  return { ok: true };
}

export async function completeDetailsWithType(
  deps: OrganizationOnboardingFlowDeps,
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
  const t = await completeStep(deps, userId, entityId, "type");
  if (!t.ok) return t;
  return completeStep(deps, userId, entityId, "details");
}

export async function submitForReview(
  deps: OrganizationOnboardingFlowDeps,
  userId: string,
  entityId: string,
): Promise<SubmitForReviewResult> {
  const membership = await deps.legalEntityRepository.findActiveMembership(userId, entityId);
  if (!membership) return { ok: false, code: "forbidden" };
  if (!isOwnerOrAdmin(membership.role)) return { ok: false, code: "forbidden" };

  const rows = await deps.db
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

  const progressRows = await deps.db
    .select({ stepKey: legalEntityOnboardingProgress.stepKey })
    .from(legalEntityOnboardingProgress)
    .where(eq(legalEntityOnboardingProgress.legalEntityId, entityId));
  const done = new Set(progressRows.map((r) => r.stepKey));

  const missing = ORG_ONBOARDING_STEPS.filter((s) => !done.has(s));
  if (missing.length > 0) {
    return { ok: false, code: "onboarding_steps_incomplete", missingSteps: [...missing] };
  }

  const [u] = await deps.db
    .select({ kycStatus: user.kycStatus })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!u || u.kycStatus !== "approved") {
    return { ok: false, code: "user_identity_not_verified" };
  }

  if (done.has("connect") && deps.stripeConnect?.isConfigured()) {
    try {
      await deps.stripeConnect.syncAccountFromStripe(entityId);
    } catch {
      return { ok: false, code: "connect_sync_failed" };
    }
  }

  const op: LifecycleSelfOp = "submit_for_review";
  const txnResult = await deps.db.transaction(async (tx) => {
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

    await deps.domainEventPublisher.publish(tx, {
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

  if (deps.options.onSubmittedForReview) {
    await deps.options.onSubmittedForReview({
      legalEntityId: entityId,
      displayName: row.displayName,
      actorUserId: userId,
    });
  }

  return { ok: true, status: txnResult.status };
}

async function assertRegisteredAddress(
  deps: OrganizationOnboardingFlowDeps,
  entityId: string,
): Promise<boolean> {
  const [a] = await deps.db
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
