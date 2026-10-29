import { memberChangePolicy, organisationInviteRefusal } from "@auction/domain";
import type {
  DbTransaction,
  IEntityInvitationRepository,
  ITransactionRunner,
  InvitationRow,
} from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import { legalEntityMemberRoles } from "@auction/types";
import type { IDomainEventSink } from "../domain-event-sink.js";
import { MemberPermissionError } from "../interfaces/member-management.js";
import type {
  IOrganisationInvitationService,
  OrganisationInvitationView,
} from "../interfaces/organisation-invitations.js";
import type { LegalEntityMembershipGuard } from "../legal-entity-membership.guard.js";

export type OrganisationInvitationServiceDeps = {
  transactionRunner: ITransactionRunner;
  invitations: IEntityInvitationRepository;
  membership: Pick<LegalEntityMembershipGuard, "assertActorCan">;
  domainEventSink: IDomainEventSink;
  now?: () => Date;
};

/** Refused when a withdrawn invitation can no longer be opened again. */
export const INVITATION_NOT_RESTORABLE = "invitation_not_restorable";

type EventType = "legal_entity.invitation_withdrawn" | "legal_entity.invitation_restored";

function isMemberRole(value: string | null): value is LegalEntityMemberRole {
  return value !== null && (legalEntityMemberRoles as readonly string[]).includes(value);
}

export class OrganisationInvitationService implements IOrganisationInvitationService {
  constructor(private readonly deps: OrganisationInvitationServiceDeps) {}

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  async listPending(legalEntityId: string): Promise<OrganisationInvitationView[]> {
    const rows = await this.deps.invitations.listPendingForEntity(legalEntityId);
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      sentAt: row.sentAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    }));
  }

  async withdraw(actingUserId: string, legalEntityId: string, invitationId: string) {
    const { invitation, role } = await this.authorise(actingUserId, legalEntityId, invitationId);
    if (invitation.status !== "pending") throw new MemberPermissionError("invitation_not_found");
    await this.deps.transactionRunner.runInTransaction(async (tx) => {
      await this.deps.invitations.forConnection(tx).markInvitationRevoked(invitation.id);
      await this.publish(tx, "legal_entity.invitation_withdrawn", {
        actingUserId,
        legalEntityId,
        invitationId: invitation.id,
        role,
      });
    });
  }

  async restore(actingUserId: string, legalEntityId: string, invitationId: string) {
    const { invitation, role } = await this.authorise(actingUserId, legalEntityId, invitationId);
    const status = await this.deps.invitations.findLegalEntityStatus(legalEntityId);
    const stateRefusal = status ? organisationInviteRefusal(status) : null;
    if (stateRefusal) throw new MemberPermissionError(stateRefusal.code);
    if (invitation.status !== "revoked" || invitation.expiresAt <= this.now()) {
      throw new MemberPermissionError(INVITATION_NOT_RESTORABLE);
    }
    await this.deps.transactionRunner.runInTransaction(async (tx) => {
      const repo = this.deps.invitations.forConnection(tx);
      // A newer invitation to the same address replaced this one; two open links never coexist.
      if (await repo.hasPendingForEntity(invitation.email, legalEntityId)) {
        throw new MemberPermissionError(INVITATION_NOT_RESTORABLE);
      }
      if (!(await repo.markInvitationPending(invitation.id))) {
        throw new MemberPermissionError(INVITATION_NOT_RESTORABLE);
      }
      await this.publish(tx, "legal_entity.invitation_restored", {
        actingUserId,
        legalEntityId,
        invitationId: invitation.id,
        role,
      });
    });
  }

  /**
   * The invitation, if it belongs to the organisation, and whether the person may handle it:
   * the same rule as sending an invitation for that role (only owners handle owner invitations).
   */
  private async authorise(
    actingUserId: string,
    legalEntityId: string,
    invitationId: string,
  ): Promise<{ invitation: InvitationRow; role: LegalEntityMemberRole }> {
    const me = await this.deps.membership.assertActorCan(
      actingUserId,
      legalEntityId,
      "entity.members.manage",
    );
    const invitation = await this.deps.invitations.findById(invitationId);
    const role = invitation?.targetLegalEntityMemberRole ?? null;
    if (!invitation || invitation.targetLegalEntityId !== legalEntityId || !isMemberRole(role)) {
      throw new MemberPermissionError("invitation_not_found");
    }
    const decision = memberChangePolicy(
      { role: me.role, memberId: me.id },
      { action: "invite", newRole: role },
    );
    if (!decision.allowed) throw new MemberPermissionError(decision.reason);
    return { invitation, role };
  }

  private publish(
    tx: DbTransaction,
    eventType: EventType,
    input: {
      actingUserId: string;
      legalEntityId: string;
      invitationId: string;
      role: LegalEntityMemberRole;
    },
  ) {
    return this.deps.domainEventSink.withTx(tx).publish({
      aggregateType: "legal_entity",
      aggregateId: input.legalEntityId,
      eventType,
      payload: { invitation_id: input.invitationId, role: input.role },
      actorUserId: input.actingUserId,
      actingLegalEntityId: input.legalEntityId,
      schemaVersion: 1,
      producer: "apps/api",
    });
  }
}
