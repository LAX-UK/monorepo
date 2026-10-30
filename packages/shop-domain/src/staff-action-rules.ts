import type { ShopStaffCapability } from "./staff-capabilities.js";

/**
 * Rules on single staff actions that a role alone cannot express. Each is a row here, applied
 * where the action runs, so a new rule never becomes a check spread across call sites.
 */

/** Money actions that, when one person requests them, must be approved by someone else. */
export const SEPARATE_APPROVER_ACTIONS = [
  "refund.write",
  "payout.mark_paid",
] as const satisfies readonly ShopStaffCapability[];

export type SeparateApproverAction = (typeof SEPARATE_APPROVER_ACTIONS)[number];

export type SeparateApproverCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "approver_missing" | "approver_is_requester" };

/**
 * A refund requested, or a payout marked paid, by `requestedBy` must be approved by a different
 * person. Approval is needed only where the action asks for it (`approvalRequired`).
 */
export function checkSeparateApprover(input: {
  readonly action: SeparateApproverAction;
  readonly requestedBy: string;
  readonly approvedBy: string | null | undefined;
  readonly approvalRequired: boolean;
}): SeparateApproverCheck {
  if (!input.approvalRequired) return { ok: true };
  const approver = input.approvedBy?.trim();
  if (!approver) return { ok: false, reason: "approver_missing" };
  if (approver === input.requestedBy.trim()) return { ok: false, reason: "approver_is_requester" };
  return { ok: true };
}

/**
 * Capabilities only the Administrator holds, whatever other roles are added later: correcting a
 * run's edition facts after sales, approving hors commerce proofs, settings, and erasing a
 * guest's personal data.
 */
export const ADMINISTRATOR_ONLY_CAPABILITIES = [
  "edition_facts.correct",
  "hors_commerce.approve",
  "settings.write",
  "lead.erase",
] as const satisfies readonly ShopStaffCapability[];
