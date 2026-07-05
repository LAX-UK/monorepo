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

/** Deterministic admin status transitions. Returns null when disallowed. */
export function nextStatusForLifecycleOp(
  current: LegalEntityStatus,
  op: LifecycleAdminOp,
): LifecycleTransitionResult | null {
  switch (op) {
    case "request_docs":
      if (current !== "lead" && current !== "docs_received" && current !== "under_review") {
        return null;
      }
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

export type LifecycleSelfOp = "submit_for_review";

/** Maps a self-service lifecycle op to the next status, or null if disallowed. */
export function nextStatusForSelfOp(
  current: LegalEntityStatus,
  op: LifecycleSelfOp,
): LegalEntityStatus | null {
  if (op === "submit_for_review" && (current === "lead" || current === "docs_requested")) {
    return "docs_received";
  }
  return null;
}
