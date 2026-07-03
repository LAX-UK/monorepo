import type { Database } from "@auction/db";
import type { legalEntityMember } from "@auction/db/schema";
import type { LegalEntityMember, LegalEntityMemberRole } from "@auction/types";
import type { MemberWithUser } from "../../services/interfaces/member-management.js";

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
  findActiveAdminMembership(
    actingUserId: string,
    legalEntityId: string,
  ): Promise<LegalEntityMemberRow>;
  updateRole(memberId: string, role: LegalEntityMemberRole): Promise<LegalEntityMember>;
  markRemoved(tx: Database, memberId: string): Promise<void>;
  demotePrimaryAdmin(tx: Database, memberId: string): Promise<LegalEntityMember>;
  promotePrimaryAdmin(tx: Database, memberId: string): Promise<LegalEntityMember>;
}
