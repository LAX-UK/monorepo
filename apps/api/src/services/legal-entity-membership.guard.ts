import type { ILegalEntityMemberRepository } from "@auction/persistence";
import type { LegalEntityMemberRole } from "@auction/types";
import { MemberPermissionError } from "./interfaces/member-management.js";

const ADMIN_ROLES: LegalEntityMemberRole[] = ["owner", "admin"];

export class LegalEntityMembershipGuard {
  constructor(private readonly members: ILegalEntityMemberRepository) {}

  async assertActorIsAdmin(actingUserId: string, legalEntityId: string) {
    const me = await this.members.findActiveMembership(actingUserId, legalEntityId);
    if (!me || !me.acceptedAt) {
      throw new MemberPermissionError("not_a_member");
    }
    if (!ADMIN_ROLES.includes(me.role)) {
      throw new MemberPermissionError("insufficient_role");
    }
    return me;
  }
}
