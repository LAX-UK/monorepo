import type { Database } from "@auction/db";
import type { LegalEntityMember, LegalEntityMemberRole } from "@auction/types";
import type { InvitationRow } from "./invitation.repository.js";

export type EntityInvitationCreate = {
  id: string;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  legalEntityId: string;
  memberRole: LegalEntityMemberRole;
  createdByUserId: string;
};

export type EntityMemberCreate = {
  legalEntityId: string;
  userId: string;
  role: LegalEntityMemberRole;
  invitedByUserId: string;
  invitedAt: Date;
};

export interface IEntityInvitationRepository {
  forConnection(conn: Database): IEntityInvitationRepository;
  findUserIdByEmail(email: string): Promise<string | null>;
  userExistsByEmail(email: string): Promise<boolean>;
  hasActiveMember(legalEntityId: string, userId: string): Promise<boolean>;
  revokePendingForEntity(email: string, legalEntityId: string): Promise<void>;
  insertInvitation(row: EntityInvitationCreate): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<InvitationRow | null>;
  findById(id: string): Promise<InvitationRow | null>;
  insertMember(input: EntityMemberCreate): Promise<LegalEntityMember | null>;
  markInvitationAccepted(id: string, userId: string): Promise<void>;
  markInvitationRevoked(id: string): Promise<void>;
  findUserName(userId: string): Promise<string | null>;
  findUserEmail(userId: string): Promise<string | null>;
  findLegalEntityDisplayName(legalEntityId: string): Promise<string | null>;
}
