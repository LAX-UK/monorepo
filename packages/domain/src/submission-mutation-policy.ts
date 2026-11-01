import { type EntityActor, type EntityCapability, entityActorCan } from "./entity-capabilities.js";

/** The changes a seller can make to a submission after starting it. */
export const SUBMISSION_MUTATIONS = [
  "edit",
  "submit",
  "attach_document",
  "delete_document",
  "withdraw",
  /** Write to the specialist in the consignment's messages. */
  "message",
] as const;

export type SubmissionMutation = (typeof SUBMISSION_MUTATIONS)[number];

/**
 * Who is asking: the signed-in person and their standing with the account. `null` stands for the
 * account holder of a person's own account, who always has an owner's rights.
 */
export type SubmissionMutationActor = { userId: string; member: EntityActor } | null;

/** Why a change is refused, so callers can explain it in words. */
export type SubmissionMutationDenial = "read_only" | "role" | "not_sender";

export type SubmissionMutationDecision =
  | { allowed: true }
  | { allowed: false; reason: SubmissionMutationDenial; message: string };

/**
 * What each change needs. `own` lets a member change the submissions they sent; `any` lets them
 * change every submission of the account. Before cataloguing nothing is agreed with LAX yet, so
 * a member takes back their own submission as they would edit it; taking back anyone else's
 * needs the withdrawal capability. A new change is a new row.
 */
const RULES: Record<SubmissionMutation, { own: EntityCapability; any: EntityCapability }> = {
  edit: { own: "entity.submissions.create", any: "entity.submissions.manage" },
  submit: { own: "entity.submissions.create", any: "entity.submissions.manage" },
  attach_document: { own: "entity.submissions.create", any: "entity.submissions.manage" },
  delete_document: { own: "entity.submissions.create", any: "entity.submissions.manage" },
  withdraw: { own: "entity.submissions.create", any: "entity.consignments.withdraw" },
  message: { own: "entity.submissions.create", any: "entity.submissions.manage" },
};

/** What the person reads when a change is refused, with a sharper line where one helps. */
const DENIAL_MESSAGE: Record<
  SubmissionMutationDenial,
  { default: string } & Partial<Record<SubmissionMutation, string>>
> = {
  read_only: {
    default: "You're viewing this account as LAX support, so changes are turned off.",
    message: "You're viewing this account as LAX support, so writing is turned off.",
  },
  role: {
    default: "Your role can follow this consignment but not change it.",
    withdraw: "Only an owner or admin can withdraw this consignment.",
    message:
      "Your role can read these messages. Owners, admins and the person who sent this work can write.",
  },
  not_sender: {
    default: "Only the person who sent this work, or an owner or admin, can change it.",
    message:
      "Only the person who sent this work, or an owner or admin, can write to the specialist.",
  },
};

function deny(
  reason: SubmissionMutationDenial,
  mutation: SubmissionMutation,
): SubmissionMutationDecision {
  const messages = DENIAL_MESSAGE[reason];
  return { allowed: false, reason, message: messages[mutation] ?? messages.default };
}

/**
 * Whether `actor` may make `mutation` on a submission of their account, by who sent it. The
 * submission's state (draft, needs changes, …) is the state machine's question, not this one.
 * - An account holder of a personal account may make every change.
 * - Members who manage submissions may change any; members who may start them change their own.
 * - Withdrawing someone else's submission needs the withdrawal capability; a catalogued
 *   consignment is withdrawn through `consignmentWithdrawalPath`, owners and admins only.
 * - Support staff viewing an account as its client change nothing.
 */
export function submissionMutationPolicy(
  actor: SubmissionMutationActor,
  submission: { submittedByUserId?: string | null | undefined },
  mutation: SubmissionMutation,
): SubmissionMutationDecision {
  if (!actor) return { allowed: true };
  const { member, userId } = actor;
  if (member.isImpersonation) return deny("read_only", mutation);
  const rule = RULES[mutation];
  if (entityActorCan(member, rule.any)) return { allowed: true };
  if (!entityActorCan(member, rule.own)) return deny("role", mutation);
  const sentByActor = (submission.submittedByUserId ?? null) === userId;
  return sentByActor ? { allowed: true } : deny("not_sender", mutation);
}

/** The refusal for a role that may make `mutation` on no submission of the account. */
export function submissionRoleRefusal(mutation: SubmissionMutation): string {
  return DENIAL_MESSAGE.role[mutation] ?? DENIAL_MESSAGE.role.default;
}
