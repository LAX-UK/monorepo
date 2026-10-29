import { type EntityCapability, entityActorCan } from "@auction/domain";
import type {
  ILegalEntityMemberRepository,
  LegalEntityMemberRow,
} from "@auction/persistence/interfaces";
import { MemberPermissionError } from "./interfaces/member-management.js";

/**
 * Proves that the signed-in person is an accepted member of the organisation and holds a
 * capability there, from the domain capability table. Support staff viewing an organisation as
 * its client are not members, so they never pass: member changes are writes.
 */
export class LegalEntityMembershipGuard {
  constructor(
    private readonly members: Pick<ILegalEntityMemberRepository, "findActiveMembership">,
  ) {}

  async assertActorCan(
    actingUserId: string,
    legalEntityId: string,
    capability: EntityCapability,
  ): Promise<LegalEntityMemberRow> {
    const me = await this.members.findActiveMembership(actingUserId, legalEntityId);
    if (!me || !me.acceptedAt) {
      throw new MemberPermissionError("not_a_member");
    }
    if (!entityActorCan({ role: me.role }, capability)) {
      throw new MemberPermissionError("insufficient_role");
    }
    return me;
  }
}
