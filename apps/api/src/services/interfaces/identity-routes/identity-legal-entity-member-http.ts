import type { InviteMemberInput } from "../member-management.js";
import type { IdentityRouteOutcome } from "./identity-route-http.js";

export interface IIdentityLegalEntityMemberHttpApplicationService {
  listMembers(input: { legalEntityId: string }): Promise<IdentityRouteOutcome<unknown[]>>;

  inviteMember(input: {
    userId: string;
    legalEntityId: string;
    body: InviteMemberInput;
  }): Promise<IdentityRouteOutcome<unknown>>;

  updateMemberRole(input: {
    userId: string;
    legalEntityId: string;
    memberId: string;
    body: { role: string };
  }): Promise<IdentityRouteOutcome<unknown>>;

  removeMember(input: {
    userId: string;
    legalEntityId: string;
    memberId: string;
    confirmationPhrase?: string;
  }): Promise<IdentityRouteOutcome<{ removed: true }>>;

  transferPrimaryAdmin(input: {
    userId: string;
    legalEntityId: string;
    memberId: string;
    confirmationPhrase: string;
  }): Promise<IdentityRouteOutcome<unknown>>;

  acceptInvitationByToken(input: {
    userId: string;
    token: string;
  }): Promise<IdentityRouteOutcome<{ legalEntityId: string; member: unknown }>>;
}
