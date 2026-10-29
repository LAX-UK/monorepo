import { organisationJoinRefusal, organisationStateAllows } from "@auction/domain";
import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type { IEntityInvitationRepository } from "@auction/persistence/interfaces";
import type { InvitationRow } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { InvitationOutcome, InvitationPreview } from "../interfaces/invitation-lifecycle.js";
import type { InvitationNotificationService } from "./invitation-notification.service.js";
import type { InvitationTokenService } from "./invitation-token.service.js";

type AcceptVia = "invitation_token" | "invitation_id";

/** The person already belongs to the organisation (HTTP 409, "You're already a member"). */
const ALREADY_A_MEMBER = "already_a_member";

export class InvitationAcceptanceService {
  constructor(
    private readonly transactionRunner: ITransactionRunner,
    private readonly repo: IEntityInvitationRepository,
    private readonly tokenService: InvitationTokenService,
    private readonly notifications: InvitationNotificationService,
    private readonly domainEventSink: IDomainEventSink,
  ) {}

  async accept(userId: string, userEmail: string, token: string): Promise<InvitationOutcome> {
    const tokenHash = this.tokenService.hashToken(token);
    return this.acceptInvitation(userId, userEmail, (txRepo) => txRepo.findByTokenHash(tokenHash));
  }

  async acceptById(
    userId: string,
    userEmail: string,
    invitationId: string,
  ): Promise<InvitationOutcome> {
    return this.acceptInvitation(
      userId,
      userEmail,
      (txRepo) => txRepo.findById(invitationId),
      "invitation_id",
    );
  }

  /**
   * What an invitation link shows the signed-in person before they accept: the organisation and
   * role while it is open, or why it is not (already a member, expired, closed, another email).
   * Reads only; the same checks as {@link accept}, so the page and the accept never disagree.
   */
  async preview(userId: string, userEmail: string, token: string): Promise<InvitationPreview> {
    const emailNorm = this.tokenService.normalizeEmail(userEmail);
    const invite = await this.repo.findByTokenHash(this.tokenService.hashToken(token));
    const legalEntityId = invite?.targetLegalEntityId;
    if (!invite || !legalEntityId) return { state: "closed" };
    // Someone signed in with another email learns nothing about the organisation.
    if (this.tokenService.normalizeEmail(invite.email) !== emailNorm) {
      return { state: "other_email" };
    }
    const validation = this.validatePendingEntityInvitation(invite, userId, emailNorm, true);
    const organisationName = (await this.repo.findLegalEntityDisplayName(legalEntityId)) ?? "";
    const alreadyMember =
      (!validation.ok && validation.code === ALREADY_A_MEMBER) ||
      (await this.repo.hasActiveMember(legalEntityId, userId));
    if (alreadyMember) return { state: "already_member", legalEntityId, organisationName };
    const status = await this.repo.findLegalEntityStatus(legalEntityId);
    if (!status || !organisationStateAllows(status, "accept_invitation"))
      return { state: "closed" };
    if (!validation.ok) {
      return validation.code === "invitation_expired"
        ? { state: "expired", organisationName }
        : { state: "closed" };
    }
    return {
      state: "open",
      legalEntityId,
      organisationName,
      role: invite.targetLegalEntityMemberRole as LegalEntityMemberRole,
      inviterName: await this.repo.findUserName(invite.createdByUserId),
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  private validatePendingEntityInvitation(
    invite: InvitationRow | null,
    userId: string,
    emailNorm: string,
    requireMemberRole: boolean,
  ): { ok: false; code: string } | { ok: true; invite: InvitationRow } {
    if (!invite) return { ok: false, code: "invitation_not_found" };
    // Accepting twice (a second tab, a double click, a reload) is not an error for the person.
    if (invite.status === "accepted" && invite.acceptedUserId === userId) {
      return { ok: false, code: ALREADY_A_MEMBER };
    }
    if (invite.status !== "pending") {
      return { ok: false, code: "invitation_not_pending" };
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      return { ok: false, code: "invitation_expired" };
    }
    if (!invite.targetLegalEntityId) {
      return { ok: false, code: "invitation_not_entity_scoped" };
    }
    if (requireMemberRole && !invite.targetLegalEntityMemberRole) {
      return { ok: false, code: "invitation_not_entity_scoped" };
    }
    if (this.tokenService.normalizeEmail(invite.email) !== emailNorm) {
      return { ok: false, code: "invitation_email_mismatch" };
    }
    return { ok: true, invite };
  }

  private async acceptInvitation(
    userId: string,
    userEmail: string,
    loadInvite: (repo: IEntityInvitationRepository) => Promise<InvitationRow | null>,
    via: AcceptVia = "invitation_token",
  ): Promise<InvitationOutcome> {
    const emailNorm = this.tokenService.normalizeEmail(userEmail);

    const txResult = await this.transactionRunner.runInTransaction(async (tx) => {
      const txRepo = this.repo.forConnection(tx);
      const invite = await loadInvite(txRepo);
      const validation = this.validatePendingEntityInvitation(invite, userId, emailNorm, true);
      if (!validation.ok) return validation;

      const { invite: validInvite } = validation;
      const legalEntityId = validInvite.targetLegalEntityId;
      if (!legalEntityId) {
        return { ok: false as const, code: "invitation_not_entity_scoped" };
      }
      // A rejected or archived organisation takes no new members, whatever was sent earlier.
      const status = await txRepo.findLegalEntityStatus(legalEntityId);
      const refusal = status
        ? organisationJoinRefusal(status)
        : { code: "organisation_closed_to_members" };
      if (refusal) return { ok: false as const, code: refusal.code };
      const memberRole = validInvite.targetLegalEntityMemberRole as LegalEntityMemberRole;

      const member = await txRepo.insertMember({
        legalEntityId,
        userId,
        role: memberRole,
        invitedByUserId: validInvite.createdByUserId,
        invitedAt: validInvite.createdAt,
      });
      // Already an active member: a concurrent accept won the race, or the person had joined
      // before this invitation was sent. Nothing else changes.
      if (!member) return { ok: false as const, code: ALREADY_A_MEMBER };

      await txRepo.markInvitationAccepted(validInvite.id, userId);

      await this.domainEventSink.withTx(tx).publish({
        aggregateType: "legal_entity",
        aggregateId: legalEntityId,
        eventType: "legal_entity.member_accepted",
        payload: {
          member_user_id: userId,
          role: member.role,
          via,
        },
        actorUserId: userId,
        actingLegalEntityId: legalEntityId,
        schemaVersion: 1,
        producer: "apps/api",
      });

      return {
        ok: true as const,
        legalEntityId,
        member,
        inviterUserId: validInvite.createdByUserId,
      };
    });

    if (!txResult.ok) {
      return txResult;
    }

    await this.notifications.notifyInviteAccepted({
      inviterUserId: txResult.inviterUserId,
      legalEntityId: txResult.legalEntityId,
      memberUserId: userId,
      memberEmail: emailNorm,
    });

    return {
      ok: true,
      kind: "accepted",
      legalEntityId: txResult.legalEntityId,
      member: txResult.member,
    };
  }

  async decline(
    userId: string,
    userEmail: string,
    invitationId: string,
    reason?: string | null,
  ): Promise<InvitationOutcome> {
    const emailNorm = this.tokenService.normalizeEmail(userEmail);

    const invite = await this.repo.findById(invitationId);
    const validation = this.validatePendingEntityInvitation(invite, userId, emailNorm, false);
    if (!validation.ok) return validation;

    const { invite: validInvite } = validation;
    const legalEntityId = validInvite.targetLegalEntityId;
    if (!legalEntityId) {
      return { ok: false, code: "invitation_not_entity_scoped" };
    }

    await this.transactionRunner.runInTransaction(async (tx) => {
      const txRepo = this.repo.forConnection(tx);
      await txRepo.markInvitationRevoked(invitationId);

      await this.domainEventSink.withTx(tx).publish({
        aggregateType: "legal_entity",
        aggregateId: legalEntityId,
        eventType: "legal_entity.member_declined",
        payload: {
          invitation_id: invitationId,
          invitee_user_id: userId,
          invitee_email: validInvite.email,
          reason: reason ?? null,
        },
        actorUserId: userId,
        actingLegalEntityId: legalEntityId,
        schemaVersion: 1,
        producer: "apps/api",
      });
    });

    await this.notifications.notifyInviteDeclined({
      inviterUserId: validInvite.createdByUserId,
      legalEntityId,
      inviteeEmail: validInvite.email,
      reason: reason ?? null,
    });

    return { ok: true, kind: "declined" };
  }
}
