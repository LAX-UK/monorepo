import { randomUUID } from "node:crypto";
import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type { IEntityInvitationRepository } from "@auction/persistence/interfaces";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IIdentitySubjectClient } from "../interfaces/identity-issuer-client.js";
import type { InviteOutcome } from "../interfaces/invitation-lifecycle.js";
import type { InviteMemberInput } from "../interfaces/member-management.js";
import { MemberPermissionError } from "../interfaces/member-management.js";
import type { LegalEntityMembershipGuard } from "../legal-entity-membership.guard.js";
import type { InvitationNotificationService } from "./invitation-notification.service.js";
import type { InvitationTokenService } from "./invitation-token.service.js";

export class InvitationInviteService {
  constructor(
    private readonly transactionRunner: ITransactionRunner,
    private readonly repo: IEntityInvitationRepository,
    private readonly tokenService: InvitationTokenService,
    private readonly notifications: InvitationNotificationService,
    private readonly domainEventSink: IDomainEventSink,
    private readonly membershipGuard: LegalEntityMembershipGuard,
    private readonly identitySubjects?: IIdentitySubjectClient,
  ) {}

  async invite(
    actingUserId: string,
    legalEntityId: string,
    input: InviteMemberInput,
  ): Promise<InviteOutcome> {
    await this.membershipGuard.assertActorIsAdmin(actingUserId, legalEntityId);
    const email = this.tokenService.normalizeEmail(input.email);
    const identitySubject = this.identitySubjects
      ? await this.identitySubjects.findSubjectByEmail(email)
      : null;
    const existingUserId = this.identitySubjects
      ? (identitySubject?.id ?? null)
      : await this.repo.findUserIdByEmail(email);

    const token = await this.transactionRunner.runInTransaction(async (tx) => {
      const txRepo = this.repo.forConnection(tx);

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
      await this.domainEventSink.withTx(tx).publish({
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

    const existingUser = this.identitySubjects
      ? existingUserId !== null
      : await this.repo.userExistsByEmail(email);
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
