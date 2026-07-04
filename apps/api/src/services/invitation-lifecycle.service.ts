import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type { IEntityInvitationRepository } from "@auction/persistence/interfaces";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type {
  IInvitationLifecycleService,
  InvitationOutcome,
  InviteOutcome,
} from "./interfaces/invitation-lifecycle.js";
import type { InviteMemberInput } from "./interfaces/member-management.js";
import type { IMembershipInviteNotifier } from "./interfaces/membership-invite-notification.js";
import { InvitationAcceptanceService } from "./invitation/invitation-acceptance.service.js";
import { InvitationInviteService } from "./invitation/invitation-invite.service.js";
import { InvitationNotificationService } from "./invitation/invitation-notification.service.js";
import { InvitationTokenService } from "./invitation/invitation-token.service.js";
import type { LegalEntityMembershipGuard } from "./legal-entity-membership.guard.js";

export class InvitationLifecycleService implements IInvitationLifecycleService {
  private readonly inviteService: InvitationInviteService;
  private readonly acceptanceService: InvitationAcceptanceService;

  constructor(
    transactionRunner: ITransactionRunner,
    invitationRepository: IEntityInvitationRepository,
    domainEventSink: IDomainEventSink,
    membershipInviteNotifier: IMembershipInviteNotifier,
    webOrigin: string,
    membershipGuard: LegalEntityMembershipGuard,
  ) {
    const tokenService = new InvitationTokenService();
    const notifications = new InvitationNotificationService(
      invitationRepository,
      membershipInviteNotifier,
      webOrigin,
    );

    this.inviteService = new InvitationInviteService(
      transactionRunner,
      invitationRepository,
      tokenService,
      notifications,
      domainEventSink,
      membershipGuard,
    );
    this.acceptanceService = new InvitationAcceptanceService(
      transactionRunner,
      invitationRepository,
      tokenService,
      notifications,
      domainEventSink,
    );
  }

  invite(
    actingUserId: string,
    legalEntityId: string,
    input: InviteMemberInput,
  ): Promise<InviteOutcome> {
    return this.inviteService.invite(actingUserId, legalEntityId, input);
  }

  accept(userId: string, userEmail: string, token: string): Promise<InvitationOutcome> {
    return this.acceptanceService.accept(userId, userEmail, token);
  }

  acceptById(userId: string, userEmail: string, invitationId: string): Promise<InvitationOutcome> {
    return this.acceptanceService.acceptById(userId, userEmail, invitationId);
  }

  decline(
    userId: string,
    userEmail: string,
    invitationId: string,
    reason?: string | null,
  ): Promise<InvitationOutcome> {
    return this.acceptanceService.decline(userId, userEmail, invitationId, reason);
  }
}
