import type { UserRole } from "@auction/types";
import type { Result } from "neverthrow";
import type { IAdminInvitationApplicationService } from "../interfaces/admin-routes.js";
import type { InvitationSummary } from "../interfaces/invitation.js";
import type {
  CreateInvitationInput,
  InvitationError,
  InvitationService,
} from "../invitation.service.js";

export class AdminInvitationApplicationService implements IAdminInvitationApplicationService {
  constructor(private readonly invitations: InvitationService) {}

  create(
    input: CreateInvitationInput,
  ): Promise<Result<{ id: string; expiresAt: Date }, InvitationError>> {
    return this.invitations.create(input);
  }

  listPendingForActor(actorUserId: string): Promise<InvitationSummary[]> {
    return this.invitations.listPendingForActor(actorUserId);
  }

  revoke(input: { actorUserId: string; invitationId: string }): Promise<
    Result<void, InvitationError>
  > {
    return this.invitations.revoke(input);
  }

  resend(input: {
    actorUserId: string;
    invitationId: string;
  }): Promise<Result<{ expiresAt: Date }, InvitationError>> {
    return this.invitations.resend(input);
  }

  preview(
    token: string,
  ): Promise<Result<{ email: string; targetRole: UserRole; expiresAt: Date }, InvitationError>> {
    return this.invitations.preview(token);
  }
}
