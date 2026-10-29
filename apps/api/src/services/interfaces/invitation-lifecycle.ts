import type { LegalEntityMember, LegalEntityMemberRole } from "@auction/types";
import type { InviteMemberInput } from "./member-management.js";

/** Result of POST /legal-entities/members invite (always email path with token). */
export type InviteOutcome = {
  memberId: null;
  invitationToken: string;
};

export type InvitationOutcome =
  | { ok: true; kind: "accepted"; legalEntityId: string; member: LegalEntityMember }
  | { ok: true; kind: "declined" }
  | { ok: false; code: string };

/**
 * What an invitation link is, for the signed-in person who opened it. Only the person it was
 * sent to learns the organisation's name.
 */
export type InvitationPreview =
  | {
      state: "open";
      legalEntityId: string;
      organisationName: string;
      role: LegalEntityMemberRole;
      inviterName: string | null;
      expiresAt: string;
    }
  | { state: "already_member"; legalEntityId: string; organisationName: string }
  | { state: "expired"; organisationName: string }
  /** Withdrawn, used by someone else, or never an organisation invitation. */
  | { state: "closed" }
  /** Sent to another email address than the signed-in person's. */
  | { state: "other_email" };

export interface IInvitationLifecycleService {
  invite(
    actingUserId: string,
    legalEntityId: string,
    input: InviteMemberInput,
  ): Promise<InviteOutcome>;

  accept(userId: string, userEmail: string, token: string): Promise<InvitationOutcome>;

  /** Reads an invitation link for the person who opened it; changes nothing. */
  preview(userId: string, userEmail: string, token: string): Promise<InvitationPreview>;

  decline(
    userId: string,
    userEmail: string,
    invitationId: string,
    reason?: string | null,
  ): Promise<InvitationOutcome>;

  /** Accept pending invite by row id (in-app inbox); email must match invitation. */
  acceptById(userId: string, userEmail: string, invitationId: string): Promise<InvitationOutcome>;
}
