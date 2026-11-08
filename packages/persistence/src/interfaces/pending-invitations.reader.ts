import type { LegalEntityMemberRole } from "@auction/types";

/** Row for GET /legal-entities/invitations/mine (no token). */
export type PendingInvitationView = {
  id: string;
  email: string;
  expiresAt: string;
  legalEntityId: string;
  orgDisplayName: string;
  orgSubkind: string;
  inviterUserId: string;
  inviterName: string;
  roleOffered: LegalEntityMemberRole;
};

export interface IPendingInvitationsReader {
  listForEmail(email: string, now: Date): Promise<PendingInvitationView[]>;
}
