import type { EntityActor } from "./entity-capabilities.js";
import { entityActorCan } from "./entity-capabilities.js";

/**
 * Which of an organisation's submissions a member sees, by who sent them:
 * - `all`: every submission, including those from before the sender was recorded.
 * - `attributed`: every submission with a recorded sender (any member).
 * - `own`: only the submissions the member sent.
 */
export type SubmissionSenderScope = "all" | "attributed" | "own";

type ScopeRule = { scope: SubmissionSenderScope; applies: (actor: EntityActor) => boolean };

const reads = (actor: EntityActor, name: Parameters<typeof entityActorCan>[1]) =>
  entityActorCan({ role: actor.role }, name);

/**
 * First match wins. The people who accept agreements run the organisation's selling and see
 * everything; members who send works see their own; members who only follow consignments see
 * every attributed one. Submissions with no recorded sender stay with owners and admins.
 */
const SCOPE_RULES: readonly ScopeRule[] = [
  { scope: "all", applies: (a) => reads(a, "entity.consignments.accept_agreement") },
  { scope: "own", applies: (a) => reads(a, "entity.submissions.create") },
  { scope: "attributed", applies: (a) => reads(a, "entity.consignments.read") },
];

/**
 * The scope for an organisation member, or `all` for a person's own account (`actor` null). A
 * member who can do none of it sees only their own, which is nothing they could not send.
 */
export function submissionSenderScope(actor: EntityActor | null): SubmissionSenderScope {
  if (!actor) return "all";
  return SCOPE_RULES.find((rule) => rule.applies(actor))?.scope ?? "own";
}

/** Whether a submission sent by `submittedByUserId` is visible to `viewerUserId` in `scope`. */
export function canSeeSubmission(input: {
  scope: SubmissionSenderScope;
  submittedByUserId: string | null | undefined;
  viewerUserId: string;
}): boolean {
  const sender = input.submittedByUserId ?? null;
  switch (input.scope) {
    case "all":
      return true;
    case "attributed":
      return sender !== null;
    case "own":
      return sender === input.viewerUserId;
  }
}
