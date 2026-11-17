import { biddingLimitRefusalFrom } from "./bidding-limit-refusal.js";
import type { BiddingLimitKind } from "./bidding-limits.js";

/**
 * A bid that staff placed on a client's behalf (a saleroom paddle or a telephone line) and that a
 * limit refused. The clerk is told on the spot which limit stopped it and how much it allows, and
 * the refusal is recorded for the audit log. The client is not notified: staff speak to them.
 *
 * - `paddle`: the paddle's limit for the sale, set when the bidder registered or checked in.
 * - `telephone`: the telephone booking's authorised maximum.
 * - the bidding-limit kinds: a buyer agent's authorisation (per lot or in total) or the
 *   organisation's own limit, which only the organisation's owners and admins can raise.
 */
export type StaffBidLimitKind = "paddle" | "telephone" | BiddingLimitKind;

export const STAFF_BID_LIMIT_KINDS: readonly StaffBidLimitKind[] = [
  "paddle",
  "telephone",
  "per_lot",
  "authorisation_total",
  "organisation",
];

export type StaffBidLimitRefusal = {
  kind: StaffBidLimitKind;
  /** GBP, major units, as a decimal string. */
  limit: string;
  /** Room left on this lot, when the limit is shared across lots; `null` when it is per bid. */
  available: string | null;
};

/** The error code an operator cap refuses with, and the facts it carries. */
export const OPERATOR_CAP_ERROR_CODES = {
  paddle: "bid_limit_exceeded",
  telephone: "authorized_max_exceeded",
} as const;

const MONEY = /^\d+(\.\d{1,2})?$/;

/**
 * The limit behind a refused staff-placed bid, or `null` when the refusal was not a limit (or
 * carried no limit to show). An operator cap names itself with `limitKind`, since a paddle's cap
 * shares its code with a buyer agent's per-lot limit.
 */
export function staffBidLimitRefusalFrom(
  code: string | null | undefined,
  details: Readonly<Record<string, string>> | null | undefined,
): StaffBidLimitRefusal | null {
  if (!code || !details?.limit || !MONEY.test(details.limit)) return null;
  const limitKind = details.limitKind;
  if (limitKind === "paddle" && code === OPERATOR_CAP_ERROR_CODES.paddle) {
    return { kind: "paddle", limit: details.limit, available: null };
  }
  if (limitKind === "telephone" && code === OPERATOR_CAP_ERROR_CODES.telephone) {
    return { kind: "telephone", limit: details.limit, available: null };
  }
  if (limitKind === "paddle" || limitKind === "telephone" || limitKind === "registration") {
    return null;
  }
  const refusal = biddingLimitRefusalFrom(code, details);
  return refusal
    ? { kind: refusal.kind, limit: refusal.limit, available: refusal.available }
    : null;
}
