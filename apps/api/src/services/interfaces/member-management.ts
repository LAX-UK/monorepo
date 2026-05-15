import type { LegalEntityMember, LegalEntityMemberRole } from "@auction/types";

export type MemberWithUser = LegalEntityMember & {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
  };
};

export type InviteMemberInput = {
  email: string;
  role: LegalEntityMemberRole;
};

export type UpdateMemberRoleInput = {
  role: LegalEntityMemberRole;
};

export class MemberPermissionError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = "MemberPermissionError";
  }
}

export interface IMemberManagementService {
  /** List active members for a legal entity (used by the team UI). */
  listMembers(legalEntityId: string): Promise<MemberWithUser[]>;

  /** Owner / admin only. Cannot demote a primary admin without a transfer. */
  updateRole(
    actingUserId: string,
    legalEntityId: string,
    memberId: string,
    input: UpdateMemberRoleInput,
  ): Promise<LegalEntityMember>;

  /** Soft-deletes the membership (`removed_at = now()`). Cannot remove the
   * primary admin (must transfer first).
   */
  removeMember(actingUserId: string, legalEntityId: string, memberId: string): Promise<void>;

  /** Transfer the primary admin flag to another active member. Both members
   * end up with `role='owner'` (the new primary) and the previous primary
   * is downgraded to `role='admin'` for safety.
   */
  transferPrimaryAdmin(
    actingUserId: string,
    legalEntityId: string,
    toMemberId: string,
  ): Promise<{ from: LegalEntityMember; to: LegalEntityMember }>;
}
