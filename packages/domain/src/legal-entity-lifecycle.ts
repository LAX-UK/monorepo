import type { LegalEntityStatus } from "@auction/types";
import { organisationStateAllows } from "./organisation-state-policy.js";

export type LifecycleAdminOp =
  | "request_docs"
  | "start_review"
  | "approve"
  | "restrict"
  | "lift_restriction"
  | "reject"
  | "archive";

export type LifecycleTransitionResult = {
  next: LegalEntityStatus;
  requiresReason: boolean;
};

export type LifecycleTransitionContext = {
  /**
   * Whether the Stripe Connect account can take payouts with nothing outstanding. The caller
   * derives it with the same rule the Connect promoter uses, so lifting a restriction cannot
   * grant `approved` ahead of Stripe.
   */
  connectReady?: boolean;
};

/** Deterministic admin status transitions. Returns null when disallowed. */
export function nextStatusForLifecycleOp(
  current: LegalEntityStatus,
  op: LifecycleAdminOp,
  context: LifecycleTransitionContext = {},
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
      return { next: "restricted", requiresReason: true };
    case "lift_restriction":
      if (current !== "restricted") return null;
      return {
        next: context.connectReady === true ? "approved" : "connect_pending",
        requiresReason: true,
      };
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

/**
 * Status changes made outside the lifecycle admin service: the Stripe Connect promoter and
 * readiness sync, Connect account creation, the post-KYC advance and `submit_for_review`. That
 * service keeps `pay_held_since` for the changes it makes; these writers do not, so none may go
 * from a status that allows paying to one that does not.
 */
export const OUTSIDE_LIFECYCLE_TRANSITIONS: readonly {
  readonly from: LegalEntityStatus;
  readonly to: LegalEntityStatus;
  readonly via: string;
}[] = [
  { from: "lead", to: "connect_pending", via: "connect account created; individual KYC passed" },
  { from: "connect_pending", to: "approved", via: "connect promoter / readiness sync" },
  {
    from: "approved",
    to: "connect_pending",
    via: "connect promoter / readiness sync / deauthorized",
  },
  { from: "lead", to: "docs_received", via: "submit_for_review" },
  { from: "docs_requested", to: "docs_received", via: "submit_for_review" },
];

/** A status change outside the lifecycle admin service that would start a pay hold. */
export class PayHoldTransitionRefusedError extends Error {
  readonly code = "pay_hold_transition_refused";
  constructor(
    readonly from: LegalEntityStatus,
    readonly to: LegalEntityStatus,
  ) {
    super(
      `Refusing legal entity status change ${from} -> ${to}: it ends the right to pay and must go through the lifecycle admin service, which records pay_held_since.`,
    );
    this.name = "PayHoldTransitionRefusedError";
  }
}

/** Throws when `from` -> `to` goes from a pay-allowed status to a held one. */
export function assertNotPayHoldStart(from: LegalEntityStatus, to: LegalEntityStatus): void {
  if (organisationStateAllows(from, "pay") && !organisationStateAllows(to, "pay")) {
    throw new PayHoldTransitionRefusedError(from, to);
  }
}
