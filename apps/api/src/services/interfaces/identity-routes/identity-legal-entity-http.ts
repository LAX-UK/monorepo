import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { ActingContextCookieV1 } from "@auction/types";
import type { IdentityRouteOutcome } from "./identity-route-http.js";

type ActiveMembershipRow = Awaited<
  ReturnType<ILegalEntityRepository["listActiveMembershipsForUser"]>
>[number];

export interface IIdentityLegalEntityHttpApplicationService {
  listMyMemberships(input: { userId: string }): Promise<
    IdentityRouteOutcome<ActiveMembershipRow[]>
  >;

  listPendingInvitations(input: { userId: string }): Promise<IdentityRouteOutcome<unknown[]>>;

  acceptInvitationById(input: {
    userId: string;
    invitationId: string;
  }): Promise<IdentityRouteOutcome<{ legalEntityId: string; member: unknown }>>;

  declineInvitation(input: {
    userId: string;
    invitationId: string;
    reason?: string | null;
  }): Promise<IdentityRouteOutcome<{ declined: true }>>;

  getLegalEntityDetail(input: {
    userId: string;
    userRole?: string | undefined;
    userStaffRole?: string | null | undefined;
    legalEntityId: string;
    actingLegalEntityCookie: ActingContextCookieV1 | null;
  }): Promise<{ status: number; body: unknown }>;

  markActingContextTooltipSeen(input: {
    userId: string;
  }): Promise<IdentityRouteOutcome<{ dismissed: true }>>;
}
