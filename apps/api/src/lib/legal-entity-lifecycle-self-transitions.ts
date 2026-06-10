import type { LegalEntityStatus } from "@auction/types";

export type LifecycleSelfOp = "submit_for_review";

/** Maps a self-service lifecycle op to the next status, or `null` if disallowed. */
export function nextStatusForSelfOp(
  current: LegalEntityStatus,
  op: LifecycleSelfOp,
): LegalEntityStatus | null {
  if (op === "submit_for_review" && (current === "lead" || current === "docs_requested")) {
    return "docs_received";
  }
  return null;
}
