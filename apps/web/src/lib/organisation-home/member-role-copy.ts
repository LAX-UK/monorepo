import { organisationRoleInSentence } from "@/lib/presenters/organisation-role/organisation-role-presentation";
import { type MemberAbility, entityRoleCan, memberAbilities } from "@auction/domain";
import type { LegalEntityMemberRole } from "@auction/types";

/** Each ability as a phrase that completes "You can …". */
const ABILITY_PHRASES: Record<MemberAbility, string> = {
  manage_members: "invite people and choose what each of them can do",
  bid_freely: "bid for the organisation",
  bid_when_authorised:
    "bid for the organisation in the sales you're authorised for, up to your limit",
  sell_works: "send works to sell for the organisation and follow their progress",
  accept_agreements: "accept consignment agreements on its behalf",
  follow_consignments: "follow the organisation's consignments",
  pay_purchases: "pay for what it buys",
  see_payouts: "see its payouts and statements",
  see_works: "see the works it owns",
};

/** "a, b and c". */
function joinPhrases(phrases: readonly string[]): string {
  if (phrases.length <= 1) return phrases[0] ?? "";
  return `${phrases.slice(0, -1).join(", ")} and ${phrases.at(-1)}`;
}

/** What the role lets the person do, as phrases. */
export function abilityPhrases(role: LegalEntityMemberRole): string[] {
  return memberAbilities(role).map((ability) => ABILITY_PHRASES[ability]);
}

/**
 * "What can I do here?": the role in one paragraph, from the same capability table the server
 * uses, plus where the person's own activity lives.
 */
export function roleExplanation(role: LegalEntityMemberRole, organisationName: string): string {
  const phrases = abilityPhrases(role);
  const can =
    phrases.length > 0
      ? `As ${organisationRoleInSentence(role)} at ${organisationName}, you can ${joinPhrases(phrases)}.`
      : `As ${organisationRoleInSentence(role)} at ${organisationName}, you can look but not act.`;
  const others = entityRoleCan(role, "entity.members.manage")
    ? ""
    : " Anything else is done by its owners and admins.";
  return `${can}${others} Your own bids, purchases and sales stay in your personal account; switch between them from the account menu.`;
}

/** The welcome card's opening line. */
export function welcomeHeadline(role: LegalEntityMemberRole, organisationName: string): string {
  return `You're now ${organisationRoleInSentence(role)} at ${organisationName}.`;
}

/** The role guide's question at the foot of Home: "What can I do here as an owner?". */
export function roleQuestion(role: LegalEntityMemberRole): string {
  return `What can I do here as ${organisationRoleInSentence(role)}?`;
}
