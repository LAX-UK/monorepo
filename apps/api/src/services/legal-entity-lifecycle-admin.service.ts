import type { Database } from "@auction/db";
import { legalEntity } from "@auction/db/schema";
import type { LegalEntityStatus } from "@auction/types";
import { eq } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";
import {
  type LifecycleAdminOp,
  nextStatusForLifecycleOp,
} from "../lib/legal-entity-lifecycle-transitions.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";

/** Distinct `domain_events.event_type` per admin lifecycle operation.
 * `start_review` maps to `legal_entity.review_started` (past-tense, matches
 * `artist.reviewed` / `legal_entity.docs_requested`).
 */
export function lifecycleDomainEventTypeForOp(op: LifecycleAdminOp): string {
  switch (op) {
    case "request_docs":
      return "legal_entity.docs_requested";
    case "start_review":
      return "legal_entity.review_started";
    case "approve":
      return "legal_entity.approved";
    case "restrict":
      return "legal_entity.restricted";
    case "reject":
      return "legal_entity.rejected";
    case "archive":
      return "legal_entity.archived";
    default: {
      const _exhaustive: never = op;
      return _exhaustive;
    }
  }
}

export type LegalEntityLifecycleFailure = {
  code: string;
  message: string;
  status: number;
};

export type LegalEntityLifecycleAdminOptions = {
  /** after successful archive transition (post-commit). */
  enqueueArchiveCascade?: (legalEntityId: string) => Promise<void>;
};

export class LegalEntityLifecycleAdminService {
  constructor(
    private readonly db: Database,
    private readonly publisher: DomainEventPublisher,
    private readonly options: LegalEntityLifecycleAdminOptions = {},
  ) {}

  async runTransition(
    actorUserId: string,
    entityId: string,
    op: LifecycleAdminOp,
    reason?: string | null,
  ): Promise<Result<{ id: string; status: LegalEntityStatus }, LegalEntityLifecycleFailure>> {
    const preRows = await this.db
      .select()
      .from(legalEntity)
      .where(eq(legalEntity.id, entityId))
      .limit(1);
    const pre = preRows[0];
    if (!pre) {
      return err({ code: "not_found", message: "Legal entity not found", status: 404 });
    }

    const preStatus = pre.status as LegalEntityStatus;
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

    const result = await this.db.transaction(async (tx) => {
      const lockedRows = await tx
        .select()
        .from(legalEntity)
        .where(eq(legalEntity.id, entityId))
        .for("update")
        .limit(1);
      const row = lockedRows[0];
      if (!row) {
        return err({ code: "not_found", message: "Legal entity not found", status: 404 });
      }
      const lockedStatus = row.status as LegalEntityStatus;
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

      await tx
        .update(legalEntity)
        .set({
          status: navLocked.next,
          statusChangedAt: new Date(),
          statusChangedByUserId: actorUserId,
          updatedAt: new Date(),
        })
        .where(eq(legalEntity.id, entityId));

      await this.publisher.publish(tx, {
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

    return result;
  }
}
