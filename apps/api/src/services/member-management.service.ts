import {
  MEMBER_REMOVED_STOP_REASON,
  type MemberChange,
  OWNER_ROLE,
  STEPPED_DOWN_OWNER_ROLE,
  authorisationRevocationFor,
  holdsOwnership,
  memberChangeConfirmationPhrase,
  memberChangePolicy,
  memberChangeTarget,
  memberLeavePolicy,
} from "@auction/domain";
import type {
  DbTransaction,
  ILegalEntityMemberRepository,
  ILegalEntityRepository,
  ITransactionRunner,
  LegalEntityMemberRow,
} from "@auction/persistence/interfaces";
import { rowToLegalEntityMember } from "@auction/persistence/lib";
import type { LegalEntityMember } from "@auction/types";
import type { IDomainEventSink } from "./domain-event-sink.js";
import {
  type IMemberManagementService,
  MemberChangeConfirmationError,
  MemberPermissionError,
  type MemberWithUser,
  type UpdateMemberRoleInput,
} from "./interfaces/member-management.js";
import type {
  IMemberAuthorisationRevoker,
  IProxyCancelledRealtime,
  IRemovedMemberBidStopper,
  StoppedInstruction,
} from "./interfaces/organisation-membership-service.js";
import type { LegalEntityMembershipGuard } from "./legal-entity-membership.guard.js";

export type MemberManagementServiceDeps = {
  transactionRunner: ITransactionRunner;
  members: ILegalEntityMemberRepository;
  membership: Pick<LegalEntityMembershipGuard, "assertActorCan">;
  domainEventSink: IDomainEventSink;
  bidStopper: IRemovedMemberBidStopper;
  authorisationRevoker: IMemberAuthorisationRevoker;
  realtime: IProxyCancelledRealtime;
  /** Whether the account is a person's own (which they cannot leave). */
  accounts: Pick<ILegalEntityRepository, "findById">;
  /** Tells the organisation's owners and admins that someone left. */
  leaveNotifier: IMemberLeftNotifier;
};

/** Tells the people who run an organisation that a member left it. */
export interface IMemberLeftNotifier {
  memberLeft(input: { legalEntityId: string; memberUserId: string }): Promise<void>;
}

/** The acting member and the team, read and locked inside one change's transaction. */
type LockedTeam = { me: LegalEntityMemberRow; team: LegalEntityMemberRow[] };

export class MemberManagementService implements IMemberManagementService {
  constructor(private readonly deps: MemberManagementServiceDeps) {}

  listMembers(legalEntityId: string): Promise<MemberWithUser[]> {
    return this.deps.members.listMembersWithUsers(legalEntityId);
  }

  async updateRole(
    actingUserId: string,
    legalEntityId: string,
    memberId: string,
    input: UpdateMemberRoleInput,
  ): Promise<LegalEntityMember> {
    await this.assertManages(actingUserId, legalEntityId);
    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      const locked = await this.lockTeam(tx, actingUserId, legalEntityId);
      const target = findMember(locked.team, memberId, "member_not_found");
      const change: MemberChange = {
        action: "change_role",
        target: memberChangeTarget(target, locked.team),
        newRole: input.role,
      };
      this.authorise(locked.me, change);
      if (target.role === input.role) return rowToLegalEntityMember(target);

      const updated = await this.deps.members.updateRole(tx, memberId, {
        role: input.role,
        // The legacy primary flag follows ownership: it never outlives the owner role.
        isPrimaryAdmin: target.isPrimaryAdmin && holdsOwnership(input.role),
      });
      await this.revokeAuthorisations(tx, change, target, actingUserId, legalEntityId);
      await this.publishRoleChanged(tx, {
        legalEntityId,
        actingUserId,
        member: target,
        toRole: input.role,
      });
      return updated;
    });
  }

  async removeMember(actingUserId: string, legalEntityId: string, memberId: string): Promise<void> {
    await this.assertManages(actingUserId, legalEntityId);
    const existing = await this.deps.members.findMemberById(memberId);
    if (!existing || existing.legalEntityId !== legalEntityId) {
      throw new MemberPermissionError("member_not_found");
    }
    const stopInput = { legalEntityId, memberUserId: existing.userId, actorUserId: actingUserId };

    // A retried removal is a no-op apart from stopping anything still left running; the
    // removal itself, and its email, are recorded once.
    if (existing.removedAt) {
      const stopped = await this.deps.transactionRunner.runInTransaction(async (tx) => {
        await this.deps.authorisationRevoker.revokeFor(tx, {
          ...stopInput,
          cause: "member_removed",
        });
        return this.deps.bidStopper.stopFor(tx, stopInput);
      });
      await this.announceStopped(stopped, existing.userId);
      return;
    }

    // Placed bids stand; the member's automatic bids and authorisations for the organisation
    // end with the removal, atomically, as the bidding engine would refuse them anyway.
    const stopped = await this.deps.transactionRunner.runInTransaction(async (tx) => {
      const locked = await this.lockTeam(tx, actingUserId, legalEntityId);
      const target = findMember(locked.team, memberId, "member_not_found");
      const change: MemberChange = {
        action: "remove",
        target: memberChangeTarget(target, locked.team),
      };
      this.authorise(locked.me, change);

      await this.deps.members.markRemoved(tx, memberId);
      const stoppedInTx = await this.deps.bidStopper.stopFor(tx, stopInput);
      await this.revokeAuthorisations(tx, change, target, actingUserId, legalEntityId);
      await this.deps.domainEventSink.withTx(tx).publish({
        aggregateType: "legal_entity",
        aggregateId: legalEntityId,
        eventType: "legal_entity.member_removed",
        payload: {
          member_user_id: target.userId,
          removed_by_user_id: actingUserId,
          role_at_removal: target.role,
          reason: null,
          stopped_bids: stoppedInTx.map((s) => ({ kind: s.kind, lot_id: s.lotId })),
        },
        actorUserId: actingUserId,
        actingLegalEntityId: legalEntityId,
        schemaVersion: 1,
        producer: "apps/api",
      });
      return stoppedInTx;
    });
    await this.announceStopped(stopped, existing.userId);
  }

  async leave(actingUserId: string, legalEntityId: string): Promise<void> {
    const account = await this.deps.accounts.findById(legalEntityId);
    if (!account) throw new MemberPermissionError("not_a_member");
    // The same consequences as a removal: automatic bids and authorisations end, placed bids
    // stand, all in the transaction that ends the membership.
    const stopped = await this.deps.transactionRunner.runInTransaction(async (tx) => {
      const { me, team } = await this.lockTeam(tx, actingUserId, legalEntityId);
      const decision = memberLeavePolicy({
        actor: { role: me.role },
        accountKind: account.kind === "individual" ? "personal" : "organisation",
        self: memberChangeTarget(me, team),
      });
      if (!decision.allowed) throw new MemberPermissionError(decision.reason);

      await this.deps.members.markRemoved(tx, me.id);
      const stopInput = { legalEntityId, memberUserId: actingUserId, actorUserId: actingUserId };
      const stoppedInTx = await this.deps.bidStopper.stopFor(tx, stopInput);
      await this.deps.authorisationRevoker.revokeFor(tx, { ...stopInput, cause: "member_removed" });
      await this.deps.domainEventSink.withTx(tx).publish({
        aggregateType: "legal_entity",
        aggregateId: legalEntityId,
        eventType: "legal_entity.member_left",
        payload: {
          member_user_id: actingUserId,
          role_at_leaving: me.role,
          stopped_bids: stoppedInTx.map((s) => ({ kind: s.kind, lot_id: s.lotId })),
        },
        actorUserId: actingUserId,
        actingLegalEntityId: legalEntityId,
        schemaVersion: 1,
        producer: "apps/api",
      });
      return stoppedInTx;
    });
    await this.announceStopped(stopped, actingUserId);
    await this.deps.leaveNotifier.memberLeft({ legalEntityId, memberUserId: actingUserId });
  }

  async transferOwnership(
    actingUserId: string,
    legalEntityId: string,
    toMemberId: string,
    confirmationPhrase: string,
  ): Promise<{ from: LegalEntityMember; to: LegalEntityMember }> {
    await this.assertManages(actingUserId, legalEntityId);
    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      const locked = await this.lockTeam(tx, actingUserId, legalEntityId);
      const target = findMember(locked.team, toMemberId, "target_member_not_found");
      // Ownership goes only to someone who has joined.
      if (!target.acceptedAt) throw new MemberPermissionError("target_member_not_found");
      const change: MemberChange = {
        action: "transfer_ownership",
        target: memberChangeTarget(target, locked.team),
      };
      await this.authoriseConfirmed(locked.me, change, target, confirmationPhrase);

      const { me } = locked;
      // Clear the acting owner's primary flag before the target may take it (one per entity).
      const from = await this.deps.members.updateRole(tx, me.id, {
        role: STEPPED_DOWN_OWNER_ROLE,
        isPrimaryAdmin: false,
      });
      const to = await this.deps.members.updateRole(tx, target.id, {
        role: OWNER_ROLE,
        isPrimaryAdmin: me.isPrimaryAdmin || target.isPrimaryAdmin,
      });
      await this.revokeAuthorisations(tx, change, target, actingUserId, legalEntityId);
      await this.publishRoleChanged(tx, {
        legalEntityId,
        actingUserId,
        member: me,
        toRole: STEPPED_DOWN_OWNER_ROLE,
      });
      await this.publishRoleChanged(tx, {
        legalEntityId,
        actingUserId,
        member: target,
        toRole: OWNER_ROLE,
      });
      return { from, to };
    });
  }

  /** Every member change needs the capability to manage members, from the capability table. */
  private assertManages(actingUserId: string, legalEntityId: string) {
    return this.deps.membership.assertActorCan(
      actingUserId,
      legalEntityId,
      "entity.members.manage",
    );
  }

  /** Locks the team for the change and finds the acting member in it. */
  private async lockTeam(
    tx: DbTransaction,
    actingUserId: string,
    legalEntityId: string,
  ): Promise<LockedTeam> {
    const team = await this.deps.members.lockActiveMembers(tx, legalEntityId);
    const me = team.find((m) => m.userId === actingUserId && m.acceptedAt != null);
    // Removed between the capability check and the lock.
    if (!me) throw new MemberPermissionError("not_a_member");
    return { me, team };
  }

  private authorise(me: LegalEntityMemberRow, change: MemberChange) {
    const decision = memberChangePolicy({ role: me.role, memberId: me.id }, change);
    if (!decision.allowed) throw new MemberPermissionError(decision.reason);
    return decision;
  }

  /** Authorises the change and, when it must be confirmed, checks the typed phrase. */
  private async authoriseConfirmed(
    me: LegalEntityMemberRow,
    change: MemberChange,
    target: LegalEntityMemberRow,
    phrase: string | undefined,
  ) {
    const { confirmation } = this.authorise(me, change);
    if (!confirmation) return;
    const context = await this.deps.members.findActiveMemberConfirmationContext(
      target.id,
      target.legalEntityId,
    );
    const expected = memberChangeConfirmationPhrase(confirmation, context?.memberName ?? "");
    if (phrase !== expected) throw new MemberChangeConfirmationError(confirmation, expected);
  }

  private async revokeAuthorisations(
    tx: DbTransaction,
    change: MemberChange,
    target: LegalEntityMemberRow,
    actingUserId: string,
    legalEntityId: string,
  ) {
    const cause = authorisationRevocationFor(change);
    if (!cause) return;
    await this.deps.authorisationRevoker.revokeFor(tx, {
      legalEntityId,
      memberUserId: target.userId,
      actorUserId: actingUserId,
      cause,
    });
  }

  private publishRoleChanged(
    tx: DbTransaction,
    input: {
      legalEntityId: string;
      actingUserId: string;
      member: LegalEntityMemberRow;
      toRole: LegalEntityMember["role"];
    },
  ) {
    if (input.member.role === input.toRole) return Promise.resolve();
    return this.deps.domainEventSink.withTx(tx).publish({
      aggregateType: "legal_entity",
      aggregateId: input.legalEntityId,
      eventType: "legal_entity.member_role_changed",
      payload: {
        member_user_id: input.member.userId,
        member_id: input.member.id,
        from_role: input.member.role,
        to_role: input.toRole,
      },
      actorUserId: input.actingUserId,
      actingLegalEntityId: input.legalEntityId,
      schemaVersion: 1,
      producer: "apps/api",
    });
  }

  /** Open lot pages drop the ceilings straight away; a failed notice only delays that. */
  private async announceStopped(stopped: readonly StoppedInstruction[], bidderUserId: string) {
    for (const instruction of stopped) {
      if (instruction.kind !== "auto_bid") continue;
      await this.deps.realtime
        .notifyProxyCancelled(instruction.lotId, bidderUserId, MEMBER_REMOVED_STOP_REASON)
        .catch(() => undefined);
    }
  }
}

function findMember(
  team: readonly LegalEntityMemberRow[],
  memberId: string,
  notFound: "member_not_found" | "target_member_not_found",
): LegalEntityMemberRow {
  const member = team.find((m) => m.id === memberId);
  if (!member) throw new MemberPermissionError(notFound);
  return member;
}
