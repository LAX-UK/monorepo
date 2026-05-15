import type { LegalEntityMember } from "@auction/types";
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

export interface IInvitationLifecycleService {
  invite(
    actingUserId: string,
    legalEntityId: string,
    input: InviteMemberInput,
  ): Promise<InviteOutcome>;

  accept(userId: string, userEmail: string, token: string): Promise<InvitationOutcome>;

  decline(
    userId: string,
    userEmail: string,
    invitationId: string,
    reason?: string | null,
  ): Promise<InvitationOutcome>;

  /** Accept pending invite by row id (in-app inbox); email must match invitation. */
  acceptById(userId: string, userEmail: string, invitationId: string): Promise<InvitationOutcome>;
}
