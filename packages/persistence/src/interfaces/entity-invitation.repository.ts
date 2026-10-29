import type { Database } from "@auction/db";
import type { LegalEntityMember, LegalEntityMemberRole, LegalEntityStatus } from "@auction/types";
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

/** An invitation to an organisation that nobody has answered yet, as its senders see it. */
export type EntityPendingInvitation = {
  id: string;
  email: string;
  role: LegalEntityMemberRole;
  sentAt: Date;
  expiresAt: Date;
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
  /**
   * Adds the person to the organisation. `null` when they are already an active member: a
   * concurrent accept of the same invitation got there first.
   */
  insertMember(input: EntityMemberCreate): Promise<LegalEntityMember | null>;
  markInvitationAccepted(id: string, userId: string): Promise<void>;
  markInvitationRevoked(id: string): Promise<void>;
  /** The organisation's unanswered invitations, newest first; expired ones are included. */
  listPendingForEntity(legalEntityId: string): Promise<EntityPendingInvitation[]>;
  /** Whether `email` already has an unanswered invitation to the organisation. */
  hasPendingForEntity(email: string, legalEntityId: string): Promise<boolean>;
  /** Re-opens a withdrawn invitation; `false` when it was not withdrawn. */
  markInvitationPending(id: string): Promise<boolean>;
  findUserName(userId: string): Promise<string | null>;
  findUserEmail(userId: string): Promise<string | null>;
  findLegalEntityDisplayName(legalEntityId: string): Promise<string | null>;
  /** The organisation's verification state, or `null` when it does not exist. */
  findLegalEntityStatus(legalEntityId: string): Promise<LegalEntityStatus | null>;
}
