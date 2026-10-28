import type { LegalEntityMemberRole } from "@auction/types";
import { roleBidsThroughAuthorisation } from "./bid-authority.js";
import { type EntityCapability, entityRoleCan } from "./entity-capabilities.js";

/**
 * What a member can do for an organisation, in the words people use, each from one capability.
 * The welcome card and "What can I do here?" read the same list, so they never disagree with
 * what the server allows.
 */
export type MemberAbility =
  | "bid_freely"
  | "bid_when_authorised"
  | "sell_works"
  | "accept_agreements"
  | "follow_consignments"
  | "pay_purchases"
  | "see_payouts"
  | "see_works"
  | "manage_members";

type AbilitySpec = {
  ability: MemberAbility;
  applies: (role: LegalEntityMemberRole) => boolean;
};

function can(capability: EntityCapability) {
  return (role: LegalEntityMemberRole) => entityRoleCan(role, capability);
}

/** In reading order; one row per ability. */
const ABILITY_SPECS: readonly AbilitySpec[] = [
  { ability: "manage_members", applies: can("entity.members.manage") },
  {
    ability: "bid_freely",
    applies: (role) =>
      entityRoleCan(role, "entity.bid.place") && !roleBidsThroughAuthorisation(role),
  },
  { ability: "bid_when_authorised", applies: roleBidsThroughAuthorisation },
  { ability: "sell_works", applies: can("entity.submissions.create") },
  { ability: "accept_agreements", applies: can("entity.consignments.accept_agreement") },
  {
    ability: "follow_consignments",
    applies: (role) =>
      entityRoleCan(role, "entity.consignments.read") &&
      !entityRoleCan(role, "entity.submissions.create"),
  },
  { ability: "pay_purchases", applies: can("entity.finance.write") },
  { ability: "see_payouts", applies: can("entity.payouts.read") },
  {
    ability: "see_works",
    applies: (role) =>
      entityRoleCan(role, "entity.holdings.read") && !entityRoleCan(role, "entity.members.manage"),
  },
];

/** The abilities of a role, in reading order. */
export function memberAbilities(role: LegalEntityMemberRole): MemberAbility[] {
  return ABILITY_SPECS.filter((spec) => spec.applies(role)).map((spec) => spec.ability);
}

/**
 * Whether the role acts in the member's own name for the organisation (bids or sends works)
 * without running it. Those members verify their own identity; the people who run the
 * organisation are checked when it is set up, and viewers act on nothing.
 */
export function roleNeedsPersonalIdentity(role: LegalEntityMemberRole): boolean {
  const acts =
    entityRoleCan(role, "entity.bid.place") || entityRoleCan(role, "entity.submissions.create");
  return acts && !entityRoleCan(role, "entity.members.manage");
}

export type WelcomeCard = {
  role: LegalEntityMemberRole;
  abilities: MemberAbility[];
  /** The member still has to verify their identity before their role can act. */
  identityStep: boolean;
};

/**
 * The one-time welcome after accepting an invitation, or `null` when there is none to show:
 * people who set the organisation up were not invited, and a dismissed card stays dismissed.
 */
export function welcomeCardFor(input: {
  role: LegalEntityMemberRole;
  /** The membership came from an invitation that was accepted. */
  invited: boolean;
  dismissed: boolean;
  identityVerified: boolean;
}): WelcomeCard | null {
  if (!input.invited || input.dismissed) return null;
  return {
    role: input.role,
    abilities: memberAbilities(input.role),
    identityStep: roleNeedsPersonalIdentity(input.role) && !input.identityVerified,
  };
}
