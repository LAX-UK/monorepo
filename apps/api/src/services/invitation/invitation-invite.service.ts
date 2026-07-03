import { randomUUID } from "node:crypto";
import type { Database } from "@auction/db";
import type { IInvitationRepository } from "../../repositories/interfaces/invitation.repository.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { InviteOutcome } from "../interfaces/invitation-lifecycle.js";
import type { InviteMemberInput } from "../interfaces/member-management.js";
import { MemberPermissionError } from "../interfaces/member-management.js";
import type { LegalEntityMembershipGuard } from "../legal-entity-membership.guard.js";
import type { InvitationNotificationService } from "./invitation-notification.service.js";
import type { InvitationTokenService } from "./invitation-token.service.js";

export class InvitationInviteService {
  constructor(
    private readonly db: Database,
    private readonly repo: IInvitationRepository,
    private readonly tokenService: InvitationTokenService,
    private readonly notifications: InvitationNotificationService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly membershipGuard: LegalEntityMembershipGuard,
  ) {}

  async invite(
    actingUserId: string,
    legalEntityId: string,
    input: InviteMemberInput,
  ): Promise<InviteOutcome> {
    await this.membershipGuard.assertActorIsAdmin(actingUserId, legalEntityId);
    const email = this.tokenService.normalizeEmail(input.email);

    const token = await this.db.transaction(async (tx) => {
      const txRepo = this.repo.forConnection(tx);
      const existingUserId = await txRepo.findUserIdByEmail(email);

      if (existingUserId) {
        const alreadyMember = await txRepo.hasActiveMember(legalEntityId, existingUserId);
        if (alreadyMember) {
          throw new MemberPermissionError("already_a_member");
        }
      }

      await txRepo.revokePendingForEntity(email, legalEntityId);

      const id = randomUUID();
      const { rawToken, tokenHash } = this.tokenService.generateToken();
      const expiresAt = this.tokenService.addDays(new Date(), 7);
      await txRepo.insertInvitation({
        id,
        email,
        tokenHash,
        expiresAt,
        legalEntityId,
        memberRole: input.role,
        createdByUserId: actingUserId,
      });
      await this.domainEventPublisher.publish(tx, {
        aggregateType: "legal_entity",
        aggregateId: legalEntityId,
        eventType: "legal_entity.member_invited",
        payload: {
          invitation_id: id,
          email,
          role: input.role,
        },
        actorUserId: actingUserId,
        actingLegalEntityId: legalEntityId,
        schemaVersion: 1,
        producer: "apps/api",
      });
      return rawToken;
    });

    const existingUser = await this.repo.userExistsByEmail(email);
    await this.notifications.notifyInviteSent({
      email,
      token,
      role: input.role,
      actingUserId,
      legalEntityId,
      existingUser,
    });

    return { memberId: null, invitationToken: token };
  }
}
