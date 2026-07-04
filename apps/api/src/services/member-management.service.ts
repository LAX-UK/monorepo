import type { ITransactionRunner } from "@auction/persistence";
import type { ILegalEntityMemberRepository } from "@auction/persistence";
import type { IRepositoryFactory } from "@auction/persistence";
import type { LegalEntityMember } from "@auction/types";
import type { IDomainEventSink } from "./domain-event-sink.js";
import {
  type IMemberManagementService,
  MemberPermissionError,
  type MemberWithUser,
  type UpdateMemberRoleInput,
} from "./interfaces/member-management.js";

export class MemberManagementService implements IMemberManagementService {
  constructor(
    private readonly transactionRunner: ITransactionRunner,
    private readonly memberRepo: ILegalEntityMemberRepository,
    private readonly domainEventSink: IDomainEventSink,
    private readonly repoFactory: IRepositoryFactory,
  ) {}

  listMembers(legalEntityId: string): Promise<MemberWithUser[]> {
    return this.memberRepo.listMembersWithUsers(legalEntityId);
  }

  getMemberForConfirmation(legalEntityId: string, memberId: string) {
    return this.memberRepo.findActiveMemberConfirmationContext(memberId, legalEntityId);
  }

  async updateRole(
    actingUserId: string,
    legalEntityId: string,
    memberId: string,
    input: UpdateMemberRoleInput,
  ): Promise<LegalEntityMember> {
    await this.memberRepo.findActiveAdminMembership(actingUserId, legalEntityId);
    const target = await this.memberRepo.findMemberById(memberId);
    if (!target || target.legalEntityId !== legalEntityId || target.removedAt) {
      throw new MemberPermissionError("member_not_found");
    }
    if (target.isPrimaryAdmin && input.role !== "owner") {
      throw new MemberPermissionError("cannot_demote_primary_admin");
    }
    const prevRole = target.role;
    const updated = await this.memberRepo.updateRole(memberId, input.role);
    if (prevRole !== input.role) {
      await this.domainEventSink.publish({
        aggregateType: "legal_entity",
        aggregateId: legalEntityId,
        eventType: "legal_entity.member_role_changed",
        payload: {
          member_user_id: target.userId,
          member_id: memberId,
          from_role: prevRole,
          to_role: input.role,
        },
        actorUserId: actingUserId,
        actingLegalEntityId: legalEntityId,
        schemaVersion: 1,
        producer: "apps/api",
      });
    }
    return updated;
  }

  async removeMember(actingUserId: string, legalEntityId: string, memberId: string): Promise<void> {
    await this.memberRepo.findActiveAdminMembership(actingUserId, legalEntityId);
    const target = await this.memberRepo.findMemberById(memberId);
    if (!target || target.legalEntityId !== legalEntityId || target.removedAt) {
      throw new MemberPermissionError("member_not_found");
    }
    if (target.isPrimaryAdmin) {
      throw new MemberPermissionError("cannot_remove_primary_admin");
    }

    await this.transactionRunner.runInTransaction(async (tx) => {
      const bids = this.repoFactory.forConnection(tx).bid;
      const pairs = await bids.listActiveProxyBidPairsForMemberOnEntity(
        target.userId,
        legalEntityId,
      );
      for (const { lotId, bidderId } of pairs) {
        const cleared = await bids.clearProxyAutoBidForBidderOnLot(lotId, bidderId);
        if (cleared > 0) {
          await this.domainEventSink.withTx(tx).publish({
            aggregateType: "lot",
            aggregateId: lotId,
            eventType: "bid.proxy_cancelled",
            payload: {
              lotId,
              bidderUserId: bidderId,
              buyerLegalEntityId: legalEntityId,
              reason: "member_removed",
            },
            actorUserId: actingUserId,
            actingLegalEntityId: legalEntityId,
            schemaVersion: 1,
            producer: "apps/api",
          });
        }
      }

      await this.memberRepo.markRemoved(tx, memberId);

      await this.domainEventSink.withTx(tx).publish({
        aggregateType: "legal_entity",
        aggregateId: legalEntityId,
        eventType: "legal_entity.member_removed",
        payload: {
          member_user_id: target.userId,
          removed_by_user_id: actingUserId,
          role_at_removal: target.role,
          reason: null,
        },
        actorUserId: actingUserId,
        actingLegalEntityId: legalEntityId,
        schemaVersion: 1,
        producer: "apps/api",
      });
    });
  }

  async transferPrimaryAdmin(actingUserId: string, legalEntityId: string, toMemberId: string) {
    const me = await this.memberRepo.findActiveAdminMembership(actingUserId, legalEntityId);
    if (!me.isPrimaryAdmin) {
      throw new MemberPermissionError("only_primary_admin_can_transfer");
    }
    const target = await this.memberRepo.findMemberById(toMemberId);
    if (!target || target.legalEntityId !== legalEntityId || target.removedAt) {
      throw new MemberPermissionError("target_member_not_found");
    }
    if (target.id === me.id) {
      throw new MemberPermissionError("cannot_transfer_to_self");
    }

    return await this.transactionRunner.runInTransaction(async (tx) => {
      const from = await this.memberRepo.demotePrimaryAdmin(tx, me.id);
      const to = await this.memberRepo.promotePrimaryAdmin(tx, toMemberId);
      return { from, to };
    });
  }
}
