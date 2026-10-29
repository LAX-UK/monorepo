import type { LegalEntityMemberRole } from "@auction/types";

/** An unanswered invitation, as the people who run the team see it. */
export type OrganisationInvitationView = {
  id: string;
  email: string;
  role: LegalEntityMemberRole;
  sentAt: string;
  expiresAt: string;
};

/**
 * The organisation's unanswered invitations: listing them, and withdrawing one or taking a
 * withdrawal back. Sending again is a fresh invite, which replaces the open one. Each change is
 * decided by the member change policy for the invitation's role and refused with a
 * `MemberPermissionError`.
 */
export interface IOrganisationInvitationService {
  listPending(legalEntityId: string): Promise<OrganisationInvitationView[]>;

  /** Closes the invitation link; the person can no longer join with it. */
  withdraw(actingUserId: string, legalEntityId: string, invitationId: string): Promise<void>;

  /**
   * Opens a withdrawn invitation's link again (the Undo after withdrawing). Refused once it has
   * expired, once a newer invitation went to the same address, or while the organisation's state
   * closes inviting.
   */
  restore(actingUserId: string, legalEntityId: string, invitationId: string): Promise<void>;
}
