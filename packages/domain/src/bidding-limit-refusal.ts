import { BIDDING_LIMIT_ERROR_CODES, type BiddingLimitKind } from "./bidding-limits.js";

/**
 * What people are told when a bid for an organisation is refused at a bidding limit. The bidder
 * always hears why, in words, with the room left. The people who set the organisation's own
 * limit (owners and admins) hear too when that limit was the one that stopped the bid, since only
 * they can raise it; a buyer agent's own limits are theirs to ask about.
 */

export type BiddingLimitRefusal = {
  kind: BiddingLimitKind;
  /** GBP, major units, as decimal strings. */
  limit: string;
  available: string;
};

const KIND_BY_CODE = new Map<string, BiddingLimitKind>(
  (Object.entries(BIDDING_LIMIT_ERROR_CODES) as [BiddingLimitKind, string][]).map(
    ([kind, code]) => [code, kind],
  ),
);

/** The refusal behind a bid error, or `null` when the error is not a bidding limit. */
export function biddingLimitRefusalFrom(
  code: string | null | undefined,
  details: Readonly<Record<string, string>> | null | undefined,
): BiddingLimitRefusal | null {
  const kind = code ? KIND_BY_CODE.get(code) : undefined;
  if (!kind || !details?.limit || details.available === undefined) return null;
  return { kind, limit: details.limit, available: details.available };
}

export type BiddingLimitRefusalNotice = { title: string; message: string };

/** Formats money for a notice; injected so the domain stays free of locale code. */
export type MoneyWords = (amount: string) => string;

const REASON: Record<BiddingLimitKind, (org: string, money: string) => string> = {
  per_lot: (_org, money) => `it's above the ${money} a lot your authorisation allows`,
  authorisation_total: (_org, money) =>
    `it would take you past the ${money} your authorisation allows in total`,
  organisation: (org, money) => `it would take ${org} past its bidding limit of ${money}`,
};

const NEXT: Record<BiddingLimitKind, string> = {
  per_lot: "Ask an owner or admin to raise your authorisation if you need to bid higher.",
  authorisation_total:
    "Ask an owner or admin to raise your total, or wait until an open bid is settled.",
  organisation: "An owner or admin can raise the organisation's limit in Team › Bidding.",
};

function room(refusal: BiddingLimitRefusal, money: MoneyWords): string {
  return Number.parseFloat(refusal.available) > 0
    ? ` You can bid up to ${money(refusal.available)} on this lot.`
    : "";
}

/** The bidder's notice: what was refused, why, how much room is left and what to do. */
export function bidderRefusalNotice(input: {
  refusal: BiddingLimitRefusal;
  amount: string;
  lotTitle: string;
  organisationName: string;
  money: MoneyWords;
}): BiddingLimitRefusalNotice {
  const { refusal, money } = input;
  return {
    title: `Your bid on "${input.lotTitle}" wasn't placed`,
    message: `Your bid of ${money(input.amount)} for ${input.organisationName} wasn't placed: ${REASON[refusal.kind](input.organisationName, money(refusal.limit))}.${room(refusal, money)} ${NEXT[refusal.kind]}`,
  };
}

/**
 * The owners' and admins' notice, only when the organisation's own limit stopped the bid;
 * `null` otherwise.
 */
export function decidersRefusalNotice(input: {
  refusal: BiddingLimitRefusal;
  amount: string;
  lotTitle: string;
  bidderName: string;
  organisationName: string;
  money: MoneyWords;
}): BiddingLimitRefusalNotice | null {
  if (input.refusal.kind !== "organisation") return null;
  const { money } = input;
  return {
    title: `A bid for ${input.organisationName} was stopped at its limit`,
    message: `${input.bidderName}'s bid of ${money(input.amount)} on "${input.lotTitle}" wasn't placed: it would take ${input.organisationName} past its bidding limit of ${money(input.refusal.limit)}. Raise the limit in Team › Bidding if you want bids like this to go through.`,
  };
}
