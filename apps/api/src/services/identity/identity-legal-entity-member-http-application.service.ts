import type { OrgModuleGate } from "../../lib/org-module-gate.js";
import type { IIdentityLegalEntityMemberHttpApplicationService } from "../interfaces/identity-routes/identity-legal-entity-member-http.js";
import {
  type IdentityRouteOutcome,
  identityRouteCodeErr,
} from "../interfaces/identity-routes/identity-route-http.js";
import type { IInvitationLifecycleService } from "../interfaces/invitation-lifecycle.js";
import type { InviteMemberInput, UpdateMemberRoleInput } from "../interfaces/member-management.js";
import { MemberPermissionError } from "../interfaces/member-management.js";
import type { IMemberManagementService } from "../interfaces/member-management.js";
import type { UserService } from "../user.service.js";

const ADMIN_ROLES_FOR_TYPED_REMOVE = new Set(["owner", "admin"]);

function permissionErrorStatus(code: string): number {
  switch (code) {
    case "not_a_member":
    case "insufficient_role":
    case "only_primary_admin_can_transfer":
    case "cannot_demote_primary_admin":
    case "cannot_remove_primary_admin":
    case "cannot_transfer_to_self":
    case "invitation_email_mismatch":
      return 403;
    case "already_a_member":
      return 409;
    case "member_not_found":
    case "target_member_not_found":
    case "invitation_not_found":
      return 404;
    default:
      return 400;
  }
}

function permissionOutcome(code: string): IdentityRouteOutcome<never> {
  return identityRouteCodeErr(code, permissionErrorStatus(code));
}

export class IdentityLegalEntityMemberHttpApplicationService
  implements IIdentityLegalEntityMemberHttpApplicationService
{
  constructor(
    private readonly memberManagementService: IMemberManagementService,
    private readonly invitationLifecycleService: IInvitationLifecycleService,
    private readonly orgModuleGate: OrgModuleGate,
    private readonly userService: UserService,
  ) {}

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
      if (err instanceof MemberPermissionError) {
        return permissionOutcome(err.code);
      }
      throw err;
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
      if (err instanceof MemberPermissionError) {
        return permissionOutcome(err.code);
      }
      throw err;
    }
  }

  async removeMember(input: {
    userId: string;
    legalEntityId: string;
    memberId: string;
    confirmationPhrase?: string;
  }): Promise<IdentityRouteOutcome<{ removed: true }>> {
    const targetRow = await this.memberManagementService.getMemberForConfirmation(
      input.legalEntityId,
      input.memberId,
    );

    if (targetRow && ADMIN_ROLES_FOR_TYPED_REMOVE.has(targetRow.role)) {
      const expected = `REMOVE ${targetRow.memberName}`;
      if (input.confirmationPhrase !== expected) {
        return {
          kind: "err",
          error: {
            message: "confirmation_required",
            status: 400,
            code: "confirmation_required",
            hint: `Type exactly: ${expected}`,
          },
        };
      }
    }

    try {
      await this.memberManagementService.removeMember(
        input.userId,
        input.legalEntityId,
        input.memberId,
      );
      return { kind: "ok", data: { removed: true } };
    } catch (err) {
      if (err instanceof MemberPermissionError) {
        return permissionOutcome(err.code);
      }
      throw err;
    }
  }

  async transferPrimaryAdmin(input: {
    userId: string;
    legalEntityId: string;
    memberId: string;
    confirmationPhrase: string;
  }): Promise<IdentityRouteOutcome<unknown>> {
    const targetRow = await this.memberManagementService.getMemberForConfirmation(
      input.legalEntityId,
      input.memberId,
    );
    const expected = targetRow ? `TRANSFER PRIMARY TO ${targetRow.memberName}` : "";
    if (!targetRow || input.confirmationPhrase !== expected) {
      return {
        kind: "err",
        error: {
          message: "confirmation_mismatch",
          status: 400,
          code: "confirmation_mismatch",
          ...(targetRow ? { hint: `Type exactly: ${expected}` } : { hint: "member_not_found" }),
        },
      };
    }
    try {
      const result = await this.memberManagementService.transferPrimaryAdmin(
        input.userId,
        input.legalEntityId,
        input.memberId,
      );
      return { kind: "ok", data: result };
    } catch (err) {
      if (err instanceof MemberPermissionError) {
        return permissionOutcome(err.code);
      }
      throw err;
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
