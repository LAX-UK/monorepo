/**
 * Bidding limits for organisations.
 *
 * Three limits can apply to a bid placed for an organisation:
 * - **per lot**: a buyer agent's authorisation caps any single bid (or auto-bid ceiling);
 * - **authorisation total**: a buyer agent's authorisation caps what that agent has committed
 *   for the organisation at once (in one sale, or across every sale);
 * - **organisation**: an optional cap on what everyone bidding for the organisation has
 *   committed at once, owners and admins included.
 *
 * The lowest applicable limit always wins: a bid is allowed only when it fits under every limit,
 * and a refusal names the limit that leaves the least room.
 *
 * **Exposure** is what the organisation (or one agent) could have to pay, in GBP. Per lot it is
 * the largest of the organisation's commitments on that lot, because a lot is won at most once:
 * - a leading bid on a lot still open: its amount;
 * - a maximum (auto-bid) on a lot still open that can still bid: the maximum;
 * - a scheduled absentee bid on a lot not yet closed: its maximum;
 * - a lot won and not yet paid for: the hammer price.
 * Exposure is the sum of those per-lot amounts. A new bid replaces the organisation's commitment
 * on its own lot, so that lot is left out of the exposure the bid is added to.
 *
 * Limits are checked only when a bid is placed. Lowering a limit never cancels bids already
 * placed; it blocks new ones until exposure falls back under it.
 */

export type ExposureCommitmentKind = "leading_bid" | "maximum_bid" | "absentee_bid" | "unpaid_win";

/** One thing the organisation has committed to on a lot, as the exposure reader finds it. */
export type ExposureCommitment = {
  readonly lotId: string;
  readonly saleId: string | null;
  /** The member who placed the bid or won the lot. */
  readonly userId: string;
  readonly kind: ExposureCommitmentKind;
  /** GBP, major units. */
  readonly amount: number;
};

/** Narrows exposure to one agent, and optionally one sale. */
export type ExposureScope = {
  readonly userId?: string | undefined;
  readonly saleId?: string | null | undefined;
};

export type BiddingLimitKind = "per_lot" | "authorisation_total" | "organisation";

/** One limit that applies to a bid. `exposure` leaves out the lot being bid on. */
export type ApplicableBiddingLimit = {
  readonly kind: BiddingLimitKind;
  /** GBP, major units. */
  readonly limit: number;
  /** GBP, major units; always 0 for a per-lot limit. */
  readonly exposure: number;
};

/** The limit that leaves the least room, and the highest bid it allows. */
export type BindingBiddingLimit = ApplicableBiddingLimit & {
  /** The highest bid this limit allows on the lot, never below 0. */
  readonly available: number;
};

export type BiddingLimitDecision =
  | { readonly allowed: true; readonly binding: BindingBiddingLimit | null }
  | { readonly allowed: false; readonly binding: BindingBiddingLimit };

/** Error codes the bidding channels return for each refusal; clients map these to copy. */
export const BIDDING_LIMIT_ERROR_CODES: Record<BiddingLimitKind, string> = {
  per_lot: "bid_limit_exceeded",
  authorisation_total: "authorisation_total_limit_exceeded",
  organisation: "organisation_limit_exceeded",
};

/** On a tie the more specific limit is named: it is the one the agent can ask to change. */
const TIE_ORDER: Record<BiddingLimitKind, number> = {
  per_lot: 0,
  authorisation_total: 1,
  organisation: 2,
};

const toPence = (amount: number): number => Math.round(amount * 100);
const fromPence = (pence: number): number => pence / 100;

function inScope(c: ExposureCommitment, scope: ExposureScope): boolean {
  if (scope.userId !== undefined && c.userId !== scope.userId) return false;
  if (scope.saleId != null && c.saleId !== scope.saleId) return false;
  return true;
}

/**
 * Exposure in GBP: per lot the largest commitment in scope, summed over lots. `excludeLotId`
 * leaves out the lot a new bid is for.
 */
export function exposureOf(
  commitments: readonly ExposureCommitment[],
  scope: ExposureScope = {},
  excludeLotId?: string,
): number {
  const perLot = new Map<string, number>();
  for (const c of commitments) {
    if (c.lotId === excludeLotId || !inScope(c, scope)) continue;
    const pence = toPence(c.amount);
    if (pence <= 0) continue;
    perLot.set(c.lotId, Math.max(perLot.get(c.lotId) ?? 0, pence));
  }
  let total = 0;
  for (const pence of perLot.values()) total += pence;
  return fromPence(total);
}

function availableUnder(limit: ApplicableBiddingLimit): number {
  if (limit.kind === "per_lot") return limit.limit;
  return fromPence(Math.max(0, toPence(limit.limit) - toPence(limit.exposure)));
}

/** The limit with the least room, or `null` when no limit applies. */
export function bindingBiddingLimit(
  limits: readonly ApplicableBiddingLimit[],
): BindingBiddingLimit | null {
  let binding: BindingBiddingLimit | null = null;
  for (const limit of limits) {
    const candidate = { ...limit, available: availableUnder(limit) };
    if (
      binding === null ||
      toPence(candidate.available) < toPence(binding.available) ||
      (toPence(candidate.available) === toPence(binding.available) &&
        TIE_ORDER[candidate.kind] < TIE_ORDER[binding.kind])
    ) {
      binding = candidate;
    }
  }
  return binding;
}

/** Whether a bid of `amount` (the bid, or its auto-bid ceiling) fits under every limit. */
export function decideBiddingLimits(
  amount: number,
  limits: readonly ApplicableBiddingLimit[],
): BiddingLimitDecision {
  const binding = bindingBiddingLimit(limits);
  if (binding && toPence(amount) > toPence(binding.available)) {
    return { allowed: false, binding };
  }
  return { allowed: true, binding };
}
