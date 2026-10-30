import type { EntityActor } from "./entity-capabilities.js";
import type { MemberChangeTarget } from "./member-change-policy.js";

/** Why a member cannot leave; stable keys, the words below. */
export type MemberLeaveRefusal = "read_only" | "personal_account" | "last_owner_must_transfer";

export const MEMBER_LEAVE_REFUSAL_MESSAGE: Record<MemberLeaveRefusal, string> = {
  read_only: "You're viewing this organisation as LAX support, so changes are turned off.",
  personal_account: "This is your own account. You can close it from LAX Account instead.",
  last_owner_must_transfer:
    "You're the only owner. Make someone else an owner, or transfer ownership, before you leave.",
};

export type MemberLeaveDecision =
  | { allowed: true }
  | { allowed: false; reason: MemberLeaveRefusal; message: string };

/**
 * Whether a member may leave an organisation. Any member may, whatever their role, except:
 * - support staff viewing as the client, who are not members;
 * - the holder of a personal account, which is the person themselves;
 * - the last owner, who must hand ownership on first so the organisation is never left without
 *   one (the same rule that stops the last owner being removed).
 */
export function memberLeavePolicy(input: {
  actor: EntityActor;
  accountKind: "personal" | "organisation";
  self: MemberChangeTarget;
}): MemberLeaveDecision {
  const refuse = (reason: MemberLeaveRefusal): MemberLeaveDecision => ({
    allowed: false,
    reason,
    message: MEMBER_LEAVE_REFUSAL_MESSAGE[reason],
  });
  if (input.actor.isImpersonation) return refuse("read_only");
  if (input.accountKind === "personal") return refuse("personal_account");
  if (input.self.isLastOwner) return refuse("last_owner_must_transfer");
  return { allowed: true };
}
