import {
  MEMBER_CHANGE_DENIAL_MESSAGE,
  MEMBER_LEAVE_REFUSAL_MESSAGE,
  type MemberChangeDenial,
  type MemberLeaveRefusal,
  organisationMembersRefusal,
} from "@auction/domain";
import type { OrgModuleGate } from "../../lib/org-module-gate.js";
import type { IIdentityLegalEntityMemberHttpApplicationService } from "../interfaces/identity-routes/identity-legal-entity-member-http.js";
import {
  type IdentityRouteOutcome,
  identityRouteCodeErr,
  identityRouteRefusal,
} from "../interfaces/identity-routes/identity-route-http.js";
import type { IInvitationLifecycleService } from "../interfaces/invitation-lifecycle.js";
import type { InviteMemberInput, UpdateMemberRoleInput } from "../interfaces/member-management.js";
import {
  MemberChangeConfirmationError,
  MemberPermissionError,
} from "../interfaces/member-management.js";
import type { IMemberManagementService } from "../interfaces/member-management.js";
import type { IOrganisationInvitationService } from "../interfaces/organisation-invitations.js";
import { INVITATION_NOT_RESTORABLE } from "../invitation/organisation-invitation.service.js";
import type { UserService } from "../user.service.js";

function permissionErrorStatus(code: string): number {
  switch (code) {
    case "not_a_member":
    case "insufficient_role":
    case "invitation_email_mismatch":
      return 403;
    case "already_a_member":
    case INVITATION_NOT_RESTORABLE:
      return 409;
    case "member_not_found":
    case "target_member_not_found":
    case "invitation_not_found":
      return 404;
    default:
      return 400;
  }
}

function isMemberChangeDenial(code: string): code is MemberChangeDenial {
  return Object.hasOwn(MEMBER_CHANGE_DENIAL_MESSAGE, code);
}

/**
 * A refused member change answers 403 with the policy's reason as `code` and its explanation as
 * `error`, so the page can show it as it is. Other refusals keep their codes.
 */
function isMemberLeaveRefusal(code: string): code is MemberLeaveRefusal {
  return Object.hasOwn(MEMBER_LEAVE_REFUSAL_MESSAGE, code);
}

/** Leaving is refused with the reason key: 403 for support staff, 409 when ownership is in the way. */
const LEAVE_REFUSAL_STATUS: Record<MemberLeaveRefusal, number> = {
  read_only: 403,
  personal_account: 409,
  last_owner_must_transfer: 409,
};

function permissionOutcome(code: string): IdentityRouteOutcome<never> {
  const refusal = organisationMembersRefusal(code);
  if (refusal) return identityRouteRefusal(refusal, 403);
  if (isMemberLeaveRefusal(code)) {
    return {
      kind: "err",
      error: {
        message: MEMBER_LEAVE_REFUSAL_MESSAGE[code],
        status: LEAVE_REFUSAL_STATUS[code],
        code,
      },
    };
  }
  if (isMemberChangeDenial(code)) {
    return {
      kind: "err",
      error: { message: MEMBER_CHANGE_DENIAL_MESSAGE[code], status: 403, code },
    };
  }
  return identityRouteCodeErr(code, permissionErrorStatus(code));
}

/** The code the confirmation dialog reads, per kind of typed confirmation. */
const CONFIRMATION_CODE = {
  transfer_ownership: "confirmation_mismatch",
} as const;

function confirmationOutcome(error: MemberChangeConfirmationError): IdentityRouteOutcome<never> {
  const code = CONFIRMATION_CODE[error.confirmation];
  return {
    kind: "err",
    error: { message: code, status: 400, code, hint: `Type exactly: ${error.phrase}` },
  };
}

/** Maps the member service's typed refusals to HTTP; anything else is unexpected. */
function memberChangeOutcome(err: unknown): IdentityRouteOutcome<never> {
  if (err instanceof MemberChangeConfirmationError) return confirmationOutcome(err);
  if (err instanceof MemberPermissionError) return permissionOutcome(err.code);
  throw err;
}

export class IdentityLegalEntityMemberHttpApplicationService
  implements IIdentityLegalEntityMemberHttpApplicationService
{
  constructor(
    private readonly memberManagementService: IMemberManagementService,
    private readonly invitationLifecycleService: IInvitationLifecycleService,
    private readonly orgModuleGate: OrgModuleGate,
    private readonly userService: UserService,
    private readonly organisationInvitations: IOrganisationInvitationService,
  ) {}

  async listInvitations(input: { legalEntityId: string }): Promise<
    IdentityRouteOutcome<unknown[]>
  > {
    const invitations = await this.organisationInvitations.listPending(input.legalEntityId);
    return { kind: "ok", data: invitations };
  }

  async withdrawInvitation(input: {
    userId: string;
    legalEntityId: string;
    invitationId: string;
  }): Promise<IdentityRouteOutcome<{ withdrawn: true }>> {
    try {
      await this.organisationInvitations.withdraw(
        input.userId,
        input.legalEntityId,
        input.invitationId,
      );
      return { kind: "ok", data: { withdrawn: true } };
    } catch (err) {
      return memberChangeOutcome(err);
    }
  }

  async restoreInvitation(input: {
    userId: string;
    legalEntityId: string;
    invitationId: string;
  }): Promise<IdentityRouteOutcome<{ restored: true }>> {
    try {
      await this.organisationInvitations.restore(
        input.userId,
        input.legalEntityId,
        input.invitationId,
      );
      return { kind: "ok", data: { restored: true } };
    } catch (err) {
      return memberChangeOutcome(err);
    }
  }

  async listMembers(input: { legalEntityId: string }): Promise<IdentityRouteOutcome<unknown[]>> {
    const members = await this.memberManagementService.listMembers(input.legalEntityId);
    return { kind: "ok", data: members };
  }

  async inviteMember(input: {
    userId: string;
    legalEntityId: string;
    body: InviteMemberInput;
  }): Promise<IdentityRouteOutcome<unknown>> {
    try {
      const result = await this.invitationLifecycleService.invite(
        input.userId,
        input.legalEntityId,
        input.body,
      );
      return { kind: "ok", data: result, status: 201 };
    } catch (err) {
      return memberChangeOutcome(err);
    }
  }

  async updateMemberRole(input: {
    userId: string;
    legalEntityId: string;
    memberId: string;
    body: UpdateMemberRoleInput;
  }): Promise<IdentityRouteOutcome<unknown>> {
    try {
      const updated = await this.memberManagementService.updateRole(
        input.userId,
        input.legalEntityId,
        input.memberId,
        input.body,
      );
      return { kind: "ok", data: updated };
    } catch (err) {
      return memberChangeOutcome(err);
    }
  }

  async removeMember(input: {
    userId: string;
    legalEntityId: string;
    memberId: string;
  }): Promise<IdentityRouteOutcome<{ removed: true }>> {
    try {
      await this.memberManagementService.removeMember(
        input.userId,
        input.legalEntityId,
        input.memberId,
      );
      return { kind: "ok", data: { removed: true } };
    } catch (err) {
      return memberChangeOutcome(err);
    }
  }

  async leave(input: {
    userId: string;
    legalEntityId: string;
  }): Promise<IdentityRouteOutcome<{ left: true }>> {
    try {
      await this.memberManagementService.leave(input.userId, input.legalEntityId);
      return { kind: "ok", data: { left: true } };
    } catch (err) {
      return memberChangeOutcome(err);
    }
  }

  async transferOwnership(input: {
    userId: string;
    legalEntityId: string;
    memberId: string;
    confirmationPhrase: string;
  }): Promise<IdentityRouteOutcome<unknown>> {
    try {
      const result = await this.memberManagementService.transferOwnership(
        input.userId,
        input.legalEntityId,
        input.memberId,
        input.confirmationPhrase,
      );
      return { kind: "ok", data: result };
    } catch (err) {
      return memberChangeOutcome(err);
    }
  }

  async acceptInvitationByToken(input: {
    userId: string;
    token: string;
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
    const result = await this.invitationLifecycleService.accept(input.userId, u.email, input.token);
    if (!result.ok) {
      return permissionOutcome(result.code);
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
}
