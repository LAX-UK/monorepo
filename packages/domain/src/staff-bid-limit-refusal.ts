import { biddingLimitRefusalFrom } from "./bidding-limit-refusal.js";
import type { BiddingLimitKind } from "./bidding-limits.js";

/**
 * A bid that staff placed on a client's behalf (a saleroom paddle or a telephone line) and that a
 * limit refused. The clerk is told on the spot which limit stopped it and how much it allows, and
 * the refusal is recorded for the audit log. The client is not notified: staff speak to them.
 *
 * - `paddle`: the paddle's limit for the sale, set when the bidder registered or checked in.
 * - `telephone`: the telephone booking's authorised maximum.
 * - `registration`: the limit the bidder's sale registration was approved to. It applies to a
 *   staff-placed bid when no active telephone booking covers it (an operator bypass skips it).
 * - the bidding-limit kinds: a buyer agent's authorisation (per lot or in total) or the
 *   organisation's own limit, which only the organisation's owners and admins can raise.
 */
export type StaffBidLimitKind = "paddle" | "telephone" | "registration" | BiddingLimitKind;

export const STAFF_BID_LIMIT_KINDS: readonly StaffBidLimitKind[] = [
  "paddle",
  "telephone",
  "registration",
  "per_lot",
  "authorisation_total",
  "organisation",
];

/**
 * The limit behind the refusal, as far as staff need it.
 *
 * A limit shared across lots (the organisation's own limit, or a buyer agent's total
 * authorisation) is never given to staff: its total, and the exposure it implies across the
 * bidder's other lots and sales, are not the clerk's business. Staff get only the room left on
 * this lot, which is all the clerk needs to take a bid that will go.
 */
export type StaffBidLimitRefusal =
  | {
      kind: Exclude<StaffBidLimitKind, SharedStaffBidLimitKind>;
      /** GBP, major units, as a decimal string. The cap on this bid or on this lot. */
      limit: string;
      /** For a buyer agent's per-lot limit, the room on this lot (the limit itself); else `null`. */
      available: string | null;
    }
  | {
      kind: SharedStaffBidLimitKind;
      /** Never given: the total would reveal the bidder's exposure on other lots. */
      limit: null;
      /** Room left on this lot under the shared limit. GBP, major units. */
      available: string;
    };

/** The limits shared across lots, of which staff see only the room left on this lot. */
export type SharedStaffBidLimitKind = "organisation" | "authorisation_total";

export const SHARED_STAFF_BID_LIMIT_KINDS: readonly SharedStaffBidLimitKind[] = [
  "organisation",
  "authorisation_total",
];

/** The error code an operator cap refuses with, and the facts it carries. */
export const OPERATOR_CAP_ERROR_CODES = {
  paddle: "bid_limit_exceeded",
  telephone: "authorized_max_exceeded",
} as const;

/** The code the sale-registration gate refuses an over-limit bid with. */
export const SALE_REGISTRATION_LIMIT_ERROR_CODE = "bid_limit_exceeded";

const MONEY = /^\d+(\.\d{1,2})?$/;

/**
 * The limit behind a refused staff-placed bid, or `null` when the refusal was not a limit (or
 * carried no limit to show). An operator cap or the registration gate names itself with
 * `limitKind`, since they share a code with a buyer agent's per-lot limit.
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
  if (limitKind === "registration" && code === SALE_REGISTRATION_LIMIT_ERROR_CODE) {
    return { kind: "registration", limit: details.limit, available: null };
  }
  if (limitKind === "paddle" || limitKind === "telephone" || limitKind === "registration") {
    return null;
  }
  const refusal = biddingLimitRefusalFrom(code, details);
  if (!refusal) return null;
  if (refusal.kind === "organisation" || refusal.kind === "authorisation_total") {
    // The total is dropped here, so it never reaches the clerk, the console or the audit row.
    return MONEY.test(refusal.available)
      ? { kind: refusal.kind, limit: null, available: refusal.available }
      : null;
  }
  return { kind: refusal.kind, limit: refusal.limit, available: refusal.available };
}
