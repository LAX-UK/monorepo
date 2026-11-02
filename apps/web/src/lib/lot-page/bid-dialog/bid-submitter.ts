import type { AbsenteeBidWriter, BidWriter } from "@/lib/data/contracts";
import {
  type BidFailure,
  type BidMode,
  PLACE_BID_ERROR_CODES,
  type PlaceBidErrorCode,
} from "@auction/domain";
import type { Bid } from "@auction/types";

/** Everything one confirmed bid sends, decided before the network is touched. */
export type BidSubmission = {
  lotId: string;
  mode: BidMode;
  /** The next bid the bidder is shown; a maximum on an open lot opens at it. */
  amount: string;
  /** The most the bidder will pay, for a maximum. */
  maximum: string | null;
  /** The next bid on screen when the bidder confirmed, so a late change is told, not hidden. */
  seenNextBid: string;
  /** Kept across a retry of the same bid, so a dropped connection can never place it twice. */
  idempotencyKey: string;
  /** The lot has not opened: a maximum is left to be bid from the opening. */
  scheduled: boolean;
  /** The account the maximum is left for; needed before a lot opens. */
  legalEntityId: string | null;
};

export type BidSubmitOutcome = { ok: true; bid: Bid | null } | { ok: false; failure: BidFailure };

/** What the dialog needs of the network: one call that says how it went. */
export interface BidSubmitter {
  submit(submission: BidSubmission): Promise<BidSubmitOutcome>;
}

const TYPED_CODES: ReadonlySet<string> = new Set(Object.values(PLACE_BID_ERROR_CODES));

function failureOf(refusal: {
  error: string;
  code?: string | null | undefined;
  details?: Readonly<Record<string, string>> | undefined;
}): BidFailure {
  if (refusal.code && TYPED_CODES.has(refusal.code)) {
    return {
      kind: "refused",
      refusal: { code: refusal.code as PlaceBidErrorCode, details: refusal.details ?? {} },
    };
  }
  return { kind: "rejected", message: refusal.error };
}

/**
 * Sends a confirmed bid through the right port: a bid or a maximum on an open lot is one bid
 * request; a maximum on a lot that has not opened is left as an absentee bid. A request that
 * gets no answer is reported as unreachable so the same bid can be sent again.
 */
export function createBidSubmitter(ports: {
  bidWriter: BidWriter;
  absenteeBidWriter: AbsenteeBidWriter;
}): BidSubmitter {
  return {
    async submit(submission) {
      try {
        if (submission.scheduled) {
          if (!submission.legalEntityId || submission.maximum === null) {
            return { ok: false, failure: { kind: "rejected", message: null } };
          }
          const result = await ports.absenteeBidWriter.schedule({
            lotId: submission.lotId,
            maxAmount: Number.parseFloat(submission.maximum),
            buyerLegalEntityId: submission.legalEntityId,
          });
          return result.ok ? { ok: true, bid: null } : { ok: false, failure: failureOf(result) };
        }
        const result = await ports.bidWriter.placeBid({
          lotId: submission.lotId,
          amount: Number.parseFloat(submission.amount),
          ...(submission.mode === "maximum" && submission.maximum !== null
            ? { maxAutoBidAmount: Number.parseFloat(submission.maximum) }
            : {}),
          idempotencyKey: submission.idempotencyKey,
          seenNextBid: submission.seenNextBid,
        });
        return result.ok
          ? { ok: true, bid: result.bid }
          : { ok: false, failure: failureOf(result) };
      } catch {
        return { ok: false, failure: { kind: "unreachable" } };
      }
    },
  };
}
