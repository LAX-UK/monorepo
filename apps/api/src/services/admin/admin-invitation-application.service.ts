import type {
  IUserInvitationRepository,
  InvitationAdminListFilters,
} from "@auction/persistence/interfaces";
import type { Result } from "neverthrow";
import type { IAdminInvitationApplicationService } from "../interfaces/admin-routes.js";
import type {
  CreateInvitationInput,
  InvitationError,
  InvitationService,
} from "../invitation.service.js";
import type { AdminInvitationListPage } from "./admin-invitation-list-query.service.js";
import { AdminInvitationListQueryService } from "./admin-invitation-list-query.service.js";

export class AdminInvitationApplicationService implements IAdminInvitationApplicationService {
  private readonly listQuery: AdminInvitationListQueryService;

  constructor(
    private readonly invitations: InvitationService,
    invitationRepository: IUserInvitationRepository,
  ) {
    this.listQuery = new AdminInvitationListQueryService(invitationRepository);
  }

  create(
    input: CreateInvitationInput,
  ): Promise<Result<{ id: string; expiresAt: Date }, InvitationError>> {
    return this.invitations.create(input);
  }

  getPage(
    filters: InvitationAdminListFilters,
    page: { limit: number; offset: number },
  ): Promise<AdminInvitationListPage> {
    return this.listQuery.getPage(filters, page);
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

  preview(token: string) {
    return this.invitations.preview(token);
  }
}
