import type { UserRole, UserStaffRole } from "@auction/types";
import type { Result } from "neverthrow";
import type { IAdminInvitationApplicationService } from "../interfaces/admin-routes.js";
import type {
  InvitationAdminListFilters,
  InvitationAdminListRow,
} from "../interfaces/invitation.js";
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

  listInvitations(
    filters: InvitationAdminListFilters,
    page: { limit: number; offset: number },
  ): Promise<{
    rows: InvitationAdminListRow[];
    total: number;
    pendingTotal: number;
    acceptedTotal: number;
  }> {
    return this.invitations.listInvitations(filters, page);
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

  preview(token: string): Promise<
    Result<
      {
        email: string;
        targetRole: UserRole;
        targetStaffRole: UserStaffRole | null;
        expiresAt: Date;
        entityScoped: boolean;
      },
      InvitationError
    >
  > {
    return this.invitations.preview(token);
  }
}
