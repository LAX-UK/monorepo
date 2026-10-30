import { accountBidScope, accountPurchaseScope } from "./account-buying-scope.js";
import { type EntityActor, type EntityCapability, entityActorCan } from "./entity-capabilities.js";
import { type SubmissionSenderScope, submissionSenderScope } from "./submission-visibility.js";

/**
 * Record search inside the acting account. Each group stands for one list in the workspace, and a
 * member searches a group only when they can open that list, narrowed exactly as the list is
 * (a consignor finds only the consignments they sent; a buyer agent only their own bids). The
 * scopes come from the same rules the lists use, so search can never show more than the lists.
 */
export const ACCOUNT_SEARCH_GROUPS = [
  "consignments",
  "purchases",
  "bids",
  "works",
  "invoices",
  "members",
] as const;

export type AccountSearchGroup = (typeof ACCOUNT_SEARCH_GROUPS)[number];

/**
 * Whose records a group reads for this member:
 * - consignments narrow by who sent them (`SubmissionSenderScope`);
 * - buying records are the account's (`all`) or only the member's own (`own`).
 */
export type AccountSearchScopes = {
  consignments?: SubmissionSenderScope;
  purchases?: "all" | "own";
  bids?: "all" | "own";
  works?: "all";
  invoices?: "all";
  members?: "all";
};

/** Reading capabilities count for an impersonating admin too: search only reads. */
const reads = (actor: EntityActor, name: EntityCapability) =>
  entityActorCan({ role: actor.role }, name);

type GroupRule<G extends AccountSearchGroup> = (
  actor: EntityActor,
) => AccountSearchScopes[G] | null;

/**
 * One rule per group, each the rule of the list behind it. A won work is listed once: members
 * who follow every purchase find it under Purchases, so Works is searched only by the members who
 * see the collection without its money (viewers, buyer agents).
 */
const GROUP_RULES: { [G in AccountSearchGroup]: GroupRule<G> } = {
  consignments: (actor) =>
    reads(actor, "entity.consignments.read") ? submissionSenderScope({ role: actor.role }) : null,
  purchases: (actor) => accountPurchaseScope(actor),
  bids: (actor) => accountBidScope(actor),
  works: (actor) =>
    reads(actor, "entity.holdings.read") && accountPurchaseScope(actor) !== "all" ? "all" : null,
  invoices: (actor) => (reads(actor, "entity.finance.read") ? "all" : null),
  members: (actor) => (reads(actor, "entity.members.read") ? "all" : null),
};

/** The groups this member may search, each with whose records it reads. */
export function accountSearchScopes(actor: EntityActor): AccountSearchScopes {
  const scopes: AccountSearchScopes = {};
  for (const group of ACCOUNT_SEARCH_GROUPS) {
    const scope = GROUP_RULES[group](actor);
    if (scope) Object.assign(scopes, { [group]: scope });
  }
  return scopes;
}

/** The groups this member may search, in display order. */
export function accountSearchGroupsFor(actor: EntityActor): AccountSearchGroup[] {
  const scopes = accountSearchScopes(actor);
  return ACCOUNT_SEARCH_GROUPS.filter((group) => scopes[group] !== undefined);
}

/** The shortest text worth searching; a single letter matches most of an account. */
export const ACCOUNT_SEARCH_MIN_LENGTH = 2;
/** Longer input is cut, so a pasted paragraph never becomes an expensive pattern. */
export const ACCOUNT_SEARCH_MAX_LENGTH = 100;

/**
 * What the member typed, ready for the readers:
 * - `text`: matched anywhere in a title, an artist's name, an invoice number or a person;
 * - `lotNumber`: set when the text is a lot reference ("12", "Lot 12", "#12").
 */
export type AccountSearchTerms = { text: string; lotNumber: number | null };

const LOT_REFERENCE = /^(?:lot\s*)?#?\s*(\d{1,6})$/i;

/** Terms for a query, or `null` when it is too short to search. */
export function accountSearchTerms(raw: string): AccountSearchTerms | null {
  const text = raw
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, ACCOUNT_SEARCH_MAX_LENGTH);
  const lot = LOT_REFERENCE.exec(text);
  if (text.length < ACCOUNT_SEARCH_MIN_LENGTH && !lot) return null;
  return { text, lotNumber: lot ? Number(lot[1]) : null };
}
