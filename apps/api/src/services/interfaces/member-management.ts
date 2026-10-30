import type { MemberChangeConfirmation } from "@auction/domain";
import type { MemberWithUser } from "@auction/persistence/interfaces";
import type { LegalEntityMember, LegalEntityMemberRole } from "@auction/types";
export type { MemberWithUser } from "@auction/persistence/interfaces";
export { MemberPermissionError } from "@auction/persistence/lib";

export type InviteMemberInput = {
  email: string;
  role: LegalEntityMemberRole;
};

export type UpdateMemberRoleInput = {
  role: LegalEntityMemberRole;
};

/** A change that is allowed but must first be confirmed by typing `phrase`. */
export class MemberChangeConfirmationError extends Error {
  constructor(
    readonly confirmation: MemberChangeConfirmation,
    readonly phrase: string,
  ) {
    super("confirmation_required");
    this.name = "MemberChangeConfirmationError";
  }
}

/**
 * Changes to an organisation's team. Every change is decided by the domain `memberChangePolicy`
 * (refusals throw `MemberPermissionError` with the policy's reason as `code`) and runs with the
 * team locked, so concurrent changes can never leave the organisation without an owner.
 */
export interface IMemberManagementService {
  /** Active members with their names and emails, for the people who may see the team. */
  listMembers(legalEntityId: string): Promise<MemberWithUser[]>;

  updateRole(
    actingUserId: string,
    legalEntityId: string,
    memberId: string,
    input: UpdateMemberRoleInput,
  ): Promise<LegalEntityMember>;

  /**
   * Soft-deletes the membership (`removed_at = now()`), stops the member's automatic and
   * absentee bids and ends their buyer-agent authorisations; placed bids stand. A retried
   * removal only stops what is left running.
   */
  removeMember(actingUserId: string, legalEntityId: string, memberId: string): Promise<void>;

  /**
   * The acting member leaves the organisation, with the same consequences as a removal, and its
   * owners and admins are told. Refused (`memberLeavePolicy`) for the last owner, who must hand
   * ownership on first, and for a person's own account.
   */
  leave(actingUserId: string, legalEntityId: string): Promise<void>;

  /**
   * Hands the acting owner's ownership to another accepted member: the target becomes an owner
   * and the acting owner an admin, in one transaction.
   */
  transferOwnership(
    actingUserId: string,
    legalEntityId: string,
    toMemberId: string,
    confirmationPhrase: string,
  ): Promise<{ from: LegalEntityMember; to: LegalEntityMember }>;
}
