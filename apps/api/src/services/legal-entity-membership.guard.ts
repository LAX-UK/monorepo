import { entityRoleCan } from "@auction/domain";
import type { ILegalEntityMemberRepository } from "@auction/persistence/interfaces";
import { MemberPermissionError } from "./interfaces/member-management.js";

export class LegalEntityMembershipGuard {
  constructor(private readonly members: ILegalEntityMemberRepository) {}

  async assertActorIsAdmin(actingUserId: string, legalEntityId: string) {
    const me = await this.members.findActiveMembership(actingUserId, legalEntityId);
    if (!me || !me.acceptedAt) {
      throw new MemberPermissionError("not_a_member");
    }
    if (!entityRoleCan(me.role, "entity.members.manage")) {
      throw new MemberPermissionError("insufficient_role");
    }
    return me;
  }
}
