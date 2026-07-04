import type { IEmailService } from "@auction/email";
import type {
  ILegalEntityLifecycleAdminRepository,
  ILegalEntityMemberRepository,
  ITransactionRunner,
} from "@auction/persistence";
import type { ILegalEntityRepository } from "@auction/persistence";
import type { LegalEntityStatus } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import {
  type LifecycleAdminOp,
  nextStatusForLifecycleOp,
} from "../lib/legal-entity-lifecycle-transitions.js";
import { enqueueOrgLifecycleMemberEmails } from "../lib/org-lifecycle-notifications.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import { lifecycleDomainEventTypeForOp } from "./legal-entity-lifecycle-domain-events.js";

export { lifecycleDomainEventTypeForOp } from "./legal-entity-lifecycle-domain-events.js";

export type LegalEntityLifecycleFailure = {
  code: string;
  message: string;
  status: number;
};

export type LegalEntityLifecycleAdminOptions = {
  /** after successful archive transition (post-commit). */
  enqueueArchiveCascade?: (legalEntityId: string) => Promise<void>;
  /** after approve when entity lands in `connect_pending`, refresh Stripe Connect state. */
  onApproveToConnectPending?: (legalEntityId: string) => Promise<void>;
  emailService?: IEmailService;
  legalEntityRepository?: ILegalEntityRepository;
  memberRepository?: ILegalEntityMemberRepository;
  webOrigin?: string;
  supportContactEmail?: string;
};

function resolveStatusReason(
  op: LifecycleAdminOp,
  navLocked: { requiresReason: boolean },
  reason?: string | null,
): string | null {
  if (navLocked.requiresReason && reason?.trim()) {
    return reason.trim();
  }
  if (op === "request_docs" && reason?.trim()) {
    return reason.trim();
  }
  if (op === "reject") {
    return reason?.trim() ?? null;
  }
  return null;
}

export class LegalEntityLifecycleAdminService {
  constructor(
    private readonly transactionRunner: ITransactionRunner,
    private readonly lifecycleRepo: ILegalEntityLifecycleAdminRepository,
    private readonly publisher: IDomainEventSink,
    private readonly options: LegalEntityLifecycleAdminOptions = {},
  ) {}

  async runTransition(
    actorUserId: string,
    entityId: string,
    op: LifecycleAdminOp,
    reason?: string | null,
  ): Promise<Result<{ id: string; status: LegalEntityStatus }, LegalEntityLifecycleFailure>> {
    const pre = await this.lifecycleRepo.findById(entityId);
    if (!pre) {
      return err({ code: "not_found", message: "Legal entity not found", status: 404 });
    }

    const preStatus = pre.status;
    const nav = nextStatusForLifecycleOp(preStatus, op);
    if (!nav) {
      return err({
        code: "invalid_transition",
        message: `Cannot apply ${op} from status ${preStatus}`,
        status: 422,
      });
    }
    if (nav.requiresReason) {
      const r = reason?.trim() ?? "";
      if (r.length < 3) {
        return err({
          code: "reason_required",
          message: "A reason of at least 3 characters is required for this transition",
          status: 400,
        });
      }
    }

    const result = await this.transactionRunner.runInTransaction(async (tx) => {
      const row = await this.lifecycleRepo.findByIdForUpdate(tx, entityId);
      if (!row) {
        return err({ code: "not_found", message: "Legal entity not found", status: 404 });
      }
      const lockedStatus = row.status;
      if (lockedStatus !== preStatus) {
        return err({
          code: "concurrent_modification",
          message: "Legal entity status changed concurrently; retry the transition",
          status: 409,
        });
      }

      const navLocked = nextStatusForLifecycleOp(lockedStatus, op);
      if (!navLocked) {
        return err({
          code: "invalid_transition",
          message: `Cannot apply ${op} from status ${lockedStatus}`,
          status: 422,
        });
      }

      await this.lifecycleRepo.applyTransitionUpdate(tx, {
        entityId,
        actorUserId,
        nextStatus: navLocked.next,
        statusReason: resolveStatusReason(op, navLocked, reason),
      });

      await this.publisher.withTx(tx).publish({
        aggregateType: "legal_entity",
        aggregateId: entityId,
        eventType: lifecycleDomainEventTypeForOp(op),
        payload: {
          from_status: lockedStatus,
          to_status: navLocked.next,
          reason: reason?.trim() ?? null,
        },
        actorUserId,
        actingLegalEntityId: entityId,
        schemaVersion: 1,
      });

      return ok({ id: entityId, status: navLocked.next });
    });

    if (result.isOk() && op === "archive" && this.options.enqueueArchiveCascade) {
      await this.options.enqueueArchiveCascade(entityId);
    }

    if (
      result.isOk() &&
      op === "approve" &&
      result.value.status === "connect_pending" &&
      this.options.onApproveToConnectPending
    ) {
      await this.options.onApproveToConnectPending(entityId);
    }

    if (
      result.isOk() &&
      this.options.emailService &&
      this.options.legalEntityRepository &&
      this.options.memberRepository
    ) {
      const webOrigin = this.options.webOrigin?.replace(/\/$/, "") ?? "";
      const supportContactEmail = this.options.supportContactEmail ?? "";
      if (op === "approve") {
        await enqueueOrgLifecycleMemberEmails({
          legalEntityRepository: this.options.legalEntityRepository,
          memberRepository: this.options.memberRepository,
          emailService: this.options.emailService,
          legalEntityId: entityId,
          template: "legal-entity-approved-notice",
          vars: {
            dashboardUrl: `${webOrigin}/dashboard`,
            connectUrl: `${webOrigin}/dashboard/organisations/${entityId}/connect`,
            supportContactEmail,
          },
          idempotencyPrefix: `legal-entity-approved:${entityId}`,
        });
      }
      if (op === "reject") {
        await enqueueOrgLifecycleMemberEmails({
          legalEntityRepository: this.options.legalEntityRepository,
          memberRepository: this.options.memberRepository,
          emailService: this.options.emailService,
          legalEntityId: entityId,
          template: "legal-entity-rejected-notice",
          vars: {
            rejectionReason: reason?.trim() ?? null,
            dashboardUrl: `${webOrigin}/dashboard/organisations`,
            supportContactEmail,
          },
          idempotencyPrefix: `legal-entity-rejected:${entityId}`,
        });
      }
      if (op === "request_docs") {
        await enqueueOrgLifecycleMemberEmails({
          legalEntityRepository: this.options.legalEntityRepository,
          memberRepository: this.options.memberRepository,
          emailService: this.options.emailService,
          legalEntityId: entityId,
          template: "legal-entity-docs-requested-notice",
          vars: {
            docsUrl: `${webOrigin}/dashboard/organisations/${entityId}/documents`,
            supportContactEmail,
          },
          idempotencyPrefix: `legal-entity-docs-requested:${entityId}`,
        });
      }
    }

    return result;
  }
}
