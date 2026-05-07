import type { LegalEntityStatus } from "@auction/types";

export type LifecycleAdminOp =
  | "request_docs"
  | "start_review"
  | "approve"
  | "restrict"
  | "reject"
  | "archive";

export type LifecycleTransitionResult = {
  next: LegalEntityStatus;
  requiresReason: boolean;
};

/** Deterministic admin status transitions.
 * Returns null when the operation is not allowed from the current status.
 */
export function nextStatusForLifecycleOp(
  current: LegalEntityStatus,
  op: LifecycleAdminOp,
): LifecycleTransitionResult | null {
  switch (op) {
    case "request_docs":
      if (current !== "lead") return null;
      return { next: "docs_requested", requiresReason: false };
    case "start_review":
      if (current !== "docs_received") return null;
      return { next: "under_review", requiresReason: false };
    case "approve":
      if (current !== "under_review") return null;
      return { next: "connect_pending", requiresReason: false };
    case "restrict":
      if (current !== "approved") return null;
      return { next: "restricted", requiresReason: false };
    case "reject":
      if (current === "rejected" || current === "archived") return null;
      return { next: "rejected", requiresReason: true };
    case "archive":
      if (current === "archived") return null;
      return { next: "archived", requiresReason: true };
    default:
      return null;
  }
}
