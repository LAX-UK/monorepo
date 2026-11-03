import { entityRoleCan, roleBidsThroughAuthorisation } from "@auction/domain";
import type { LegalEntityMemberRole } from "@auction/types";

/** What a role lets someone do for the organisation, in the three things people ask about. */
export type RoleAbility = {
  id: "bid" | "pay" | "sell";
  label: string;
  /** "Yes", "Once authorised" or "No": text, so the answer never rests on an icon or colour. */
  answer: "Yes" | "Once authorised" | "No";
};

function bidAnswer(role: LegalEntityMemberRole): RoleAbility["answer"] {
  if (!entityRoleCan(role, "entity.bid.place")) return "No";
  return roleBidsThroughAuthorisation(role) ? "Once authorised" : "Yes";
}

function yesNo(allowed: boolean): RoleAbility["answer"] {
  return allowed ? "Yes" : "No";
}

/** Bid, pay and sell for one role, read from the capability table so the two never disagree. */
export function roleAbilities(role: LegalEntityMemberRole): RoleAbility[] {
  return [
    { id: "bid", label: "Bid", answer: bidAnswer(role) },
    {
      id: "pay",
      label: "Pay",
      answer: yesNo(entityRoleCan(role, "entity.finance.write")),
    },
    {
      id: "sell",
      label: "Sell",
      answer: yesNo(entityRoleCan(role, "entity.submissions.create")),
    },
  ];
}
