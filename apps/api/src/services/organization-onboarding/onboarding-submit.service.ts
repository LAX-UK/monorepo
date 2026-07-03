import { type LegalEntityStatus, ORG_ONBOARDING_STEPS } from "@auction/types";
import {
  type LifecycleSelfOp,
  nextStatusForSelfOp,
} from "../../lib/legal-entity-lifecycle-self-transitions.js";
import type { IOnboardingSubmitService } from "./onboarding-context.js";
import type { OnboardingContext } from "./onboarding-context.js";
import { type SubmitForReviewResult, isOwnerOrAdmin } from "./org-onboarding-mappers.js";

export class OnboardingSubmitService implements IOnboardingSubmitService {
  constructor(private readonly ctx: OnboardingContext) {}

  async submitForReview(userId: string, entityId: string): Promise<SubmitForReviewResult> {
    const membership = await this.ctx.legalEntityRepository.findActiveMembership(userId, entityId);
    if (!membership) return { ok: false, code: "forbidden" };
    if (!isOwnerOrAdmin(membership.role)) return { ok: false, code: "forbidden" };

    const row = await this.ctx.onboardingRepo.findOrganisationById(entityId);
    if (!row || row.kind !== "organisation") return { ok: false, code: "not_found" };

    const curStatus = row.status as LegalEntityStatus;
    const nav = nextStatusForSelfOp(curStatus, "submit_for_review");
    if (!nav) {
      return { ok: false, code: "invalid_transition" };
    }

    const progressRows = await this.ctx.onboardingRepo.listCompletedStepKeys(entityId);
    const done = new Set(progressRows);

    const missing = ORG_ONBOARDING_STEPS.filter((s) => !done.has(s));
    if (missing.length > 0) {
      return { ok: false, code: "onboarding_steps_incomplete", missingSteps: [...missing] };
    }

    const kycStatus = await this.ctx.onboardingRepo.findUserKycStatus(userId);
    if (kycStatus !== "approved") {
      return { ok: false, code: "user_identity_not_verified" };
    }

    if (done.has("connect") && this.ctx.stripeConnect?.isConfigured()) {
      try {
        await this.ctx.stripeConnect.syncAccountFromStripe(entityId);
      } catch {
        return { ok: false, code: "connect_sync_failed" };
      }
    }

    const op: LifecycleSelfOp = "submit_for_review";
    const txnResult = await this.ctx.db.transaction(async (tx) => {
      const locked = await this.ctx.onboardingRepo.lockOrganisationForUpdate(entityId, tx);
      if (!locked) return { ok: false as const, code: "not_found" as const };

      const lockedStatus = locked.status as LegalEntityStatus;
      const nextStatus = nextStatusForSelfOp(lockedStatus, op);
      if (!nextStatus) {
        return { ok: false as const, code: "invalid_transition" as const };
      }

      await this.ctx.onboardingRepo.transitionOrganisationStatus(
        {
          entityId,
          userId,
          toStatus: nextStatus,
        },
        tx,
      );

      await this.ctx.domainEventPublisher.publish(tx, {
        aggregateType: "legal_entity",
        aggregateId: entityId,
        eventType: "legal_entity.lifecycle_progressed",
        payload: {
          trigger: "self_submit",
          from_status: lockedStatus,
          to_status: nextStatus,
          kind: locked.kind,
        },
        actorUserId: userId,
        actingLegalEntityId: entityId,
      });

      return { ok: true as const, status: nextStatus };
    });

    if (!txnResult || txnResult.ok === false) {
      return txnResult ?? { ok: false, code: "not_found" };
    }

    if (this.ctx.options.onSubmittedForReview) {
      await this.ctx.options.onSubmittedForReview({
        legalEntityId: entityId,
        displayName: row.displayName,
        actorUserId: userId,
      });
    }

    return { ok: true, status: txnResult.status };
  }
}
