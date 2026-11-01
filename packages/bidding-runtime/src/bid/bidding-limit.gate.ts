import type { Database } from "@auction/db";
import {
  type ApplicableBiddingLimit,
  BIDDING_LIMIT_ERROR_CODES,
  type BidAuthorityDecision,
  type BiddingLimitKind,
  type BindingBiddingLimit,
  type ExposureCommitment,
  bindingBiddingLimit,
  decideBiddingLimits,
  exposureOf,
  parseMoneyCap,
} from "@auction/domain";
import type {
  IBiddingExposureLock,
  IBiddingExposureReader,
  IOrganisationBiddingLimitReader,
} from "@auction/persistence/interfaces";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../bid-error.js";
import { numberToMoneyString } from "../bid-money.js";

export type BiddingLimitCheck = {
  legalEntityId: string;
  placedByUserId: string;
  lotId: string;
  saleId: string | null;
  /** The bid, or its auto-bid ceiling when higher. GBP, major units. */
  amount: number;
  /** The bid authority's answer for this bid; only an allowed decision carries limits. */
  authority: BidAuthorityDecision;
};

/**
 * Checks a bid against every limit that applies to it (see `bidding-limits.ts` in the domain):
 * the per-lot limit, the buyer agent's total and the organisation's own limit.
 */
export interface IBiddingLimitGate {
  /** A check before the bid transaction; refuses early with a clear reason. */
  check(input: BiddingLimitCheck): Promise<Result<void, BidError>>;
  /**
   * The deciding check inside the bid transaction: serialises the organisation's bids first, so
   * two bids racing on different lots cannot both pass and together go past a limit.
   */
  checkInTransaction(tx: Database, input: BiddingLimitCheck): Promise<Result<void, BidError>>;
  /**
   * The limit that leaves the least room for a bid on this lot, with the room it leaves, or
   * `null` when no limit applies. Reads only: nothing is locked.
   */
  room(input: Omit<BiddingLimitCheck, "amount">): Promise<BindingBiddingLimit | null>;
}

const MESSAGES: Record<BiddingLimitKind, string> = {
  per_lot: "Bid exceeds buyer agent authorisation limit",
  authorisation_total: "This bid would take you past the total your authorisation allows",
  organisation: "This bid would take the organisation past its bidding limit",
};

export function biddingLimitError(binding: BindingBiddingLimit): BidError {
  return new BidError(MESSAGES[binding.kind], 403, BIDDING_LIMIT_ERROR_CODES[binding.kind], {
    limitKind: binding.kind,
    limit: numberToMoneyString(binding.limit),
    available: numberToMoneyString(binding.available),
  });
}

function perLotLimits(authority: BidAuthorityDecision): ApplicableBiddingLimit[] {
  if (!authority.allowed || authority.bidLimit == null) return [];
  return [{ kind: "per_lot", limit: authority.bidLimit, exposure: 0 }];
}

function decide(amount: number, limits: ApplicableBiddingLimit[]): Result<void, BidError> {
  const decision = decideBiddingLimits(amount, limits);
  return decision.allowed ? ok(undefined) : err(biddingLimitError(decision.binding));
}

/** Only the per-lot limit: for wiring without organisation limits (and tests). */
export class PerLotBiddingLimitGate implements IBiddingLimitGate {
  async check(input: BiddingLimitCheck): Promise<Result<void, BidError>> {
    return decide(input.amount, perLotLimits(input.authority));
  }

  async checkInTransaction(_tx: Database, input: BiddingLimitCheck) {
    return this.check(input);
  }

  async room(input: Omit<BiddingLimitCheck, "amount">): Promise<BindingBiddingLimit | null> {
    return bindingBiddingLimit(perLotLimits(input.authority));
  }
}

export type BiddingLimitGateDeps = {
  organisationLimits: IOrganisationBiddingLimitReader;
  exposure: IBiddingExposureReader;
  lock: IBiddingExposureLock;
};

/**
 * Every limit. Exposure is read (and the organisation locked) only when an organisation limit or
 * an authorisation total is set, so bidding with no such limit works exactly as before.
 */
export class BiddingLimitGate implements IBiddingLimitGate {
  constructor(private readonly deps: BiddingLimitGateDeps) {}

  check(input: BiddingLimitCheck): Promise<Result<void, BidError>> {
    return this.run(input, null);
  }

  checkInTransaction(tx: Database, input: BiddingLimitCheck): Promise<Result<void, BidError>> {
    return this.run(input, tx);
  }

  async room(input: Omit<BiddingLimitCheck, "amount">): Promise<BindingBiddingLimit | null> {
    const limits = await this.applicableLimits(input, undefined, false);
    return bindingBiddingLimit(limits);
  }

  private async run(
    input: BiddingLimitCheck,
    tx: Database | null,
  ): Promise<Result<void, BidError>> {
    if (!input.authority.allowed) return ok(undefined);
    const limits = await this.applicableLimits(input, tx ?? undefined, tx !== null);
    return decide(input.amount, limits);
  }

  /**
   * Every limit that applies to a bid on the lot, with the exposure it is measured against.
   * Exposure is read (and, for the deciding check, the organisation locked) only when an
   * organisation limit or an authorisation total is set.
   */
  private async applicableLimits(
    input: Omit<BiddingLimitCheck, "amount">,
    tx: Database | undefined,
    lock: boolean,
  ): Promise<ApplicableBiddingLimit[]> {
    const { authority } = input;
    if (!authority.allowed) return [];

    const organisationRow = await this.deps.organisationLimits.find(input.legalEntityId, tx);
    const organisationLimit = parseMoneyCap(organisationRow?.limitAmount);
    const total = authority.totalLimit;
    if (organisationLimit == null && total == null) return perLotLimits(authority);

    if (tx && lock) await this.deps.lock.lockForLegalEntity(tx, input.legalEntityId);
    const commitments = await this.loadCommitments(input.legalEntityId, tx);
    const limits = perLotLimits(authority);
    if (total != null) {
      limits.push({
        kind: "authorisation_total",
        limit: total.limit,
        exposure: exposureOf(
          commitments,
          { userId: input.placedByUserId, saleId: total.saleId },
          input.lotId,
        ),
      });
    }
    if (organisationLimit != null) {
      limits.push({
        kind: "organisation",
        limit: organisationLimit,
        exposure: exposureOf(commitments, {}, input.lotId),
      });
    }
    return limits;
  }

  private async loadCommitments(
    legalEntityId: string,
    conn: Database | undefined,
  ): Promise<ExposureCommitment[]> {
    const rows = await this.deps.exposure.listCommitments(legalEntityId, conn);
    return rows.map((row) => ({ ...row, amount: Number.parseFloat(row.amount) }));
  }
}
