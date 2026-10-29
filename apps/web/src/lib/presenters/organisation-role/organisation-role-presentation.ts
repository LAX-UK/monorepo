import { type LegalEntityMemberRole, legalEntityMemberRoles } from "@auction/types";

/**
 * How each organisation role reads to clients, in one place: the label on badges and pickers,
 * the line that helps someone choose a role, the role inside a sentence, and the people holding
 * it as a group. Every role has every entry, so a new role fails to compile until it has words.
 * Staff tools name roles their own way and do not read this module.
 */
type RoleWords = {
  /** Badges, pickers and the account switcher: "Buyer agent". */
  label: string;
  /** One line under the role picker, completing nothing: "Bids in the sales they're authorised for." */
  description: string;
  /** Mid-sentence, with its article: "as a buyer agent", "you're an admin". */
  inSentence: string;
  /** The people holding it, mid-sentence: "buyer agents". */
  group: string;
};

const ROLE_WORDS: Record<LegalEntityMemberRole, RoleWords> = {
  owner: {
    label: "Owner",
    description: "Runs the organisation, including who owns it and its sign-in rules.",
    inSentence: "an owner",
    group: "owners",
  },
  admin: {
    label: "Admin",
    description: "Runs the team, bidding and selling. Can't change owners.",
    inSentence: "an admin",
    group: "admins",
  },
  finance: {
    label: "Finance",
    description: "Pays for purchases and sees payouts and statements.",
    inSentence: "a finance member",
    group: "finance",
  },
  consignor: {
    label: "Consignor",
    description: "Sends works to sell and follows their progress.",
    inSentence: "a consignor",
    group: "consignors",
  },
  buyer_agent: {
    label: "Buyer agent",
    description: "Bids in the sales they're authorised for, up to their limit.",
    inSentence: "a buyer agent",
    group: "buyer agents",
  },
  viewer: {
    label: "Viewer",
    description: "Sees consignments and works, and changes nothing.",
    inSentence: "a viewer",
    group: "viewers",
  },
};

function isRole(value: string): value is LegalEntityMemberRole {
  return (legalEntityMemberRoles as readonly string[]).includes(value);
}

/** A value from outside the role list, in words: "gallery_curator" reads "Gallery curator". */
function humanise(value: string): string {
  const words = value.replace(/_/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "Buyer agent". Values from outside the list (an older API) are humanised, never shown raw. */
export function organisationRoleLabel(role: LegalEntityMemberRole | string): string {
  return isRole(role) ? ROLE_WORDS[role].label : humanise(role);
}

export function organisationRoleDescription(role: LegalEntityMemberRole): string {
  return ROLE_WORDS[role].description;
}

/** "a buyer agent", "an admin". */
export function organisationRoleInSentence(role: LegalEntityMemberRole | string): string {
  if (isRole(role)) return ROLE_WORDS[role].inSentence;
  const words = humanise(role).toLowerCase();
  return `${/^[aeiou]/.test(words) ? "an" : "a"} ${words}`;
}

/** Who holds these roles, as a sentence opening: "Owners, admins and finance". */
export function organisationRoleGroupsSentence(roles: readonly LegalEntityMemberRole[]): string {
  const groups = roles.map((role) => ROLE_WORDS[role].group);
  const last = groups.pop();
  const list = groups.length > 0 ? `${groups.join(", ")} and ${last}` : (last ?? "");
  return list.charAt(0).toUpperCase() + list.slice(1);
}

/**
 * The order people are listed in a team: who runs it first, then money, selling, buying and
 * reading. Separate from the role list's own order, which other tables depend on.
 */
const LISTING_RANK: Record<LegalEntityMemberRole, number> = {
  owner: 0,
  admin: 1,
  finance: 2,
  consignor: 3,
  buyer_agent: 4,
  viewer: 5,
};

/** A role's place in a team listing (owners first). */
export function organisationRoleRank(role: LegalEntityMemberRole): number {
  return LISTING_RANK[role];
}

/** Picker options for these roles, in the order given, labelled for people. */
export function organisationRoleOptions(
  roles: readonly LegalEntityMemberRole[],
): { value: LegalEntityMemberRole; label: string }[] {
  return roles.map((role) => ({ value: role, label: ROLE_WORDS[role].label }));
}
