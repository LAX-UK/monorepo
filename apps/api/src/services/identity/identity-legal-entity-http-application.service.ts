import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { IPendingInvitationsReader } from "@auction/persistence/interfaces";
import type { ActingContextCookieV1 } from "@auction/types";
import type { OrgModuleGate } from "../../lib/org-module-gate.js";
import type { IIdentityLegalEntityHttpApplicationService } from "../interfaces/identity-routes/identity-legal-entity-http.js";
import {
  type IdentityRouteOutcome,
  identityRouteCodeErr,
} from "../interfaces/identity-routes/identity-route-http.js";
import type { IInvitationLifecycleService } from "../interfaces/invitation-lifecycle.js";
import type { LegalEntityAccessService } from "../legal-entity-access.service.js";
import type { PersonalLegalEntityResolver } from "../legal-entity/personal-legal-entity-resolver.service.js";
import type { UserService } from "../user.service.js";

function invitationStatus(code: string): number {
  switch (code) {
    case "invitation_not_found":
    case "member_not_found":
      return 404;
    case "invitation_email_mismatch":
      return 403;
    default:
      return 400;
  }
}

export class IdentityLegalEntityHttpApplicationService
  implements IIdentityLegalEntityHttpApplicationService
{
  constructor(
    private readonly legalEntityRepository: ILegalEntityRepository,
    private readonly personalLegalEntityResolver: PersonalLegalEntityResolver,
    private readonly orgModuleGate: OrgModuleGate,
    private readonly userService: UserService,
    private readonly pendingInvitationsReader: IPendingInvitationsReader,
    private readonly invitationLifecycleService: IInvitationLifecycleService,
    private readonly legalEntityAccessService: LegalEntityAccessService,
  ) {}

  async listMyMemberships(input: {
    userId: string;
  }): Promise<
    IdentityRouteOutcome<
      Awaited<ReturnType<ILegalEntityRepository["listActiveMembershipsForUser"]>>
    >
  > {
    let memberships = await this.legalEntityRepository.listActiveMembershipsForUser(input.userId);
    if (memberships.length === 0) {
      try {
        await this.personalLegalEntityResolver.resolveForUser(input.userId);
        memberships = await this.legalEntityRepository.listActiveMembershipsForUser(input.userId);
      } catch {
        return identityRouteCodeErr("personal_entity_unavailable", 503);
      }
      if (memberships.length === 0) {
        return identityRouteCodeErr("personal_entity_unavailable", 503);
      }
    }
    return { kind: "ok", data: memberships };
  }

  async listPendingInvitations(input: { userId: string }): Promise<
    IdentityRouteOutcome<unknown[]>
  > {
    if (!this.orgModuleGate.isEnabled()) {
      return { kind: "ok", data: [] };
    }
    const u = await this.userService.getById(input.userId);
    if (!u) return identityRouteCodeErr("user_not_found", 404);
    const data = await this.pendingInvitationsReader.listForEmail(u.email, new Date());
    return { kind: "ok", data };
  }

  async acceptInvitationById(input: {
    userId: string;
    invitationId: string;
  }): Promise<IdentityRouteOutcome<{ legalEntityId: string; member: unknown }>> {
    if (!this.orgModuleGate.isEnabled()) {
      const disabled = this.orgModuleGate.disabledResponse();
      return {
        kind: "err",
        error: { message: disabled.error, status: 403, code: disabled.code },
      };
    }
    const u = await this.userService.getById(input.userId);
    if (!u) return identityRouteCodeErr("user_not_found", 404);
    const result = await this.invitationLifecycleService.acceptById(
      input.userId,
      u.email,
      input.invitationId,
    );
    if (!result.ok) {
      return identityRouteCodeErr(result.code, invitationStatus(result.code));
    }
    if (result.kind !== "accepted") {
      return identityRouteCodeErr("unexpected_invitation_outcome", 500);
    }
    return {
      kind: "ok",
      data: { legalEntityId: result.legalEntityId, member: result.member },
      status: 201,
    };
  }

  async declineInvitation(input: {
    userId: string;
    invitationId: string;
    reason?: string | null;
  }): Promise<IdentityRouteOutcome<{ declined: true }>> {
    if (!this.orgModuleGate.isEnabled()) {
      const disabled = this.orgModuleGate.disabledResponse();
      return {
        kind: "err",
        error: { message: disabled.error, status: 403, code: disabled.code },
      };
    }
    const u = await this.userService.getById(input.userId);
    if (!u) return identityRouteCodeErr("user_not_found", 404);
    const result = await this.invitationLifecycleService.decline(
      input.userId,
      u.email,
      input.invitationId,
      input.reason ?? null,
    );
    if (!result.ok) {
      const status =
        result.code === "invitation_not_found"
          ? 404
          : result.code === "invitation_email_mismatch"
            ? 403
            : 400;
      return identityRouteCodeErr(result.code, status);
    }
    return { kind: "ok", data: { declined: true } };
  }

  async getLegalEntityDetail(input: {
    userId: string;
    userRole?: string | undefined;
    userStaffRole?: string | null | undefined;
    legalEntityId: string;
    actingLegalEntityCookie: ActingContextCookieV1 | null;
  }): Promise<{ status: number; body: unknown }> {
    const { userId, userRole, userStaffRole, legalEntityId, actingLegalEntityCookie } = input;
    return this.legalEntityAccessService.getLegalEntityDetailForUser({
      userId,
      userRole,
      userStaffRole,
      legalEntityId,
      actingLegalEntityCookie,
    });
  }

  async markActingContextTooltipSeen(input: {
    userId: string;
  }): Promise<IdentityRouteOutcome<{ dismissed: true }>> {
    await this.userService.markActingContextTooltipSeen(input.userId);
    return { kind: "ok", data: { dismissed: true } };
  }
}
