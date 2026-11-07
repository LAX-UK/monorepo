import type {
  ILegalEntityMembershipReader,
  IUserRepository,
} from "@auction/persistence/interfaces";

/** A party as a deal stores it: the legal entity and the person acting for it. */
export type ResolvedDealParty = { legalEntityId: string; actingUserId: string };

export type DealPartyResolverDeps = {
  memberships: Pick<ILegalEntityMembershipReader, "findActiveMembership" | "ensurePersonalEntity">;
  users: Pick<IUserRepository, "findById">;
};

/**
 * Works out which legal entity a person acts for on a deal. With no organisation named it is their
 * personal account; with one named, they must be an active member of it. Staff are never clients,
 * so a staff account cannot be a party to a deal.
 */
export class DealPartyResolver {
  constructor(private readonly deps: DealPartyResolverDeps) {}

  async resolve(input: {
    userId: string;
    legalEntityId?: string | undefined;
  }): Promise<ResolvedDealParty | null> {
    const person = await this.deps.users.findById(input.userId);
    if (!person || person.role === "staff") return null;

    if (input.legalEntityId) {
      const membership = await this.deps.memberships.findActiveMembership(
        input.userId,
        input.legalEntityId,
      );
      return membership ? { legalEntityId: input.legalEntityId, actingUserId: input.userId } : null;
    }
    try {
      const personal = await this.deps.memberships.ensurePersonalEntity(input.userId);
      return { legalEntityId: personal.id, actingUserId: input.userId };
    } catch {
      return null;
    }
  }
}
