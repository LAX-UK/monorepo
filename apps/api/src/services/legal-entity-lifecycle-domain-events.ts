import type { LifecycleAdminOp } from "../lib/legal-entity-lifecycle-transitions.js";

export const LIFECYCLE_DOMAIN_EVENT_TYPE_BY_OP: Record<LifecycleAdminOp, string> = {
  request_docs: "legal_entity.docs_requested",
  start_review: "legal_entity.review_started",
  approve: "legal_entity.approved",
  restrict: "legal_entity.restricted",
  reject: "legal_entity.rejected",
  archive: "legal_entity.archived",
};

/** Distinct `domain_events.event_type` per admin lifecycle operation.
 * `start_review` maps to `legal_entity.review_started` (past-tense, matches
 * `artist.reviewed` / `legal_entity.docs_requested`).
 */
export function lifecycleDomainEventTypeForOp(op: LifecycleAdminOp): string {
  return LIFECYCLE_DOMAIN_EVENT_TYPE_BY_OP[op] as string;
}
