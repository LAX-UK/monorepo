import { organisationRoleLabel } from "@/lib/presenters/organisation-role/organisation-role-presentation";
import type { LegalEntityMemberRole } from "@auction/types";

/**
 * Who requiring two-step affects, shown before it is turned on: each member without it, named,
 * with what happens to them; and the coverage line for the policy card.
 */

export type TwoStepPerson = { userId: string; name: string; role: LegalEntityMemberRole };

export type TwoStepImpact = {
  /** "4 of 6 people". */
  coverage: string;
  percent: number;
  /** "Tom Whitfield and Sam Kerr don't have it on."; `null` when everyone does. */
  missingLine: string | null;
  /** The people to list in the confirm, with what changes for each. */
  affected: { userId: string; name: string; detail: string }[];
};

function names(list: readonly string[]): string {
  if (list.length <= 2) return list.join(" and ");
  if (list.length === 3) return `${list[0]}, ${list[1]} and ${list[2]}`;
  return `${list[0]}, ${list[1]} and ${list.length - 2} others`;
}

const WHAT_HAPPENS: Partial<Record<LegalEntityMemberRole, string>> = {
  buyer_agent: "bids already placed stay; new ones wait until it's on",
  consignor: "works already sent carry on; new steps wait until it's on",
};

export function twoStepImpact(
  people: readonly TwoStepPerson[],
  enabledByUserId: Readonly<Record<string, boolean | null>>,
): TwoStepImpact {
  const without = people.filter((person) => enabledByUserId[person.userId] !== true);
  const on = people.length - without.length;
  return {
    coverage: `${on} of ${people.length} ${people.length === 1 ? "person" : "people"}`,
    percent: people.length === 0 ? 100 : Math.round((on / people.length) * 100),
    missingLine:
      without.length === 0
        ? null
        : `${names(without.map((p) => p.name))} ${without.length === 1 ? "doesn't" : "don't"} have it on.`,
    affected: without.map((person) => ({
      userId: person.userId,
      name: person.name,
      detail: [organisationRoleLabel(person.role), WHAT_HAPPENS[person.role]]
        .filter(Boolean)
        .join(" · "),
    })),
  };
}
