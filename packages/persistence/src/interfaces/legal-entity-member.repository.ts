import type { Database } from "@auction/db";
import type { legalEntityMember } from "@auction/db/schema";
import type { LegalEntityMember, LegalEntityMemberRole } from "@auction/types";

export type MemberWithUser = LegalEntityMember & {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
  };
};

export type LegalEntityMemberRow = typeof legalEntityMember.$inferSelect;

export type MemberConfirmationContext = {
  role: LegalEntityMemberRole;
  memberName: string;
};

export interface ILegalEntityMemberRepository {
  listMembersWithUsers(legalEntityId: string): Promise<MemberWithUser[]>;
  findMemberById(memberId: string): Promise<LegalEntityMemberRow | null>;
  findActiveMemberConfirmationContext(
    memberId: string,
    legalEntityId: string,
  ): Promise<MemberConfirmationContext | null>;
  findActiveMembership(
    actingUserId: string,
    legalEntityId: string,
  ): Promise<LegalEntityMemberRow | null>;
  /**
   * The organisation's active members (pending invitations included), locked until the
   * transaction ends, so two changes to the team can never together leave it without an owner.
   */
  lockActiveMembers(tx: Database, legalEntityId: string): Promise<LegalEntityMemberRow[]>;
  /** Sets a member's role, and whether they keep the legacy primary flag, in `tx`. */
  updateRole(
    tx: Database,
    memberId: string,
    change: { role: LegalEntityMemberRole; isPrimaryAdmin: boolean },
  ): Promise<LegalEntityMember>;
  markRemoved(tx: Database, memberId: string): Promise<void>;
}
