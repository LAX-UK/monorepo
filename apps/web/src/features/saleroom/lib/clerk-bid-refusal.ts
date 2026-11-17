import { CLERK_BID_REFUSAL_COPY } from "@/features/saleroom/lib/clerk-command-copy";
import { formatSaleroomMoney } from "@/features/saleroom/lib/format-saleroom-money";

/** Which limit stopped a bid the clerk placed, as the API names it. */
export type ClerkBidLimitKind =
  | "paddle"
  | "telephone"
  | "registration"
  | "per_lot"
  | "authorisation_total"
  | "organisation";

/**
 * A paddle or telephone bid a limit refused: the limit and, for a shared limit, the room left.
 * For the organisation's own limit the API sends only the room left on this lot.
 */
export type ClerkBidLimitRefusal =
  | {
      kind: Exclude<ClerkBidLimitKind, "organisation">;
      /** Pounds, as a decimal string. */
      limit: string;
      available: string | null;
    }
  | { kind: "organisation"; limit: null; available: string };

const KINDS = new Set<string>([
  "paddle",
  "telephone",
  "registration",
  "per_lot",
  "authorisation_total",
  "organisation",
]);
const MONEY = /^\d+(\.\d{1,2})?$/;

const money = (value: unknown): value is string => typeof value === "string" && MONEY.test(value);

/** The refusal in an API answer, or `null` when the answer is not a limit refusal. */
export function readClerkBidLimitRefusal(value: unknown): ClerkBidLimitRefusal | null {
  if (!value || typeof value !== "object") return null;
  const { kind, limit, available } = value as Record<string, unknown>;
  if (typeof kind !== "string" || !KINDS.has(kind)) return null;
  if (kind === "organisation") {
    return money(available) ? { kind, limit: null, available } : null;
  }
  if (!money(limit)) return null;
  return {
    kind: kind as Exclude<ClerkBidLimitKind, "organisation">,
    limit,
    available: money(available) ? available : null,
  };
}

/**
 * What the clerk is told when a limit refused a paddle or telephone bid: whose bid, which limit
 * and how much it allows, and what to do next. Shown as a Notice above the bid form until the
 * clerk changes the bid or places another, never as a toast.
 */
export function clerkBidRefusalNotice(input: {
  refusal: ClerkBidLimitRefusal;
  /** "Paddle 142", or the telephone bidder's name. */
  bidder: string;
  amount: number;
  currency: string;
}): { title: string; body: string } {
  const { refusal, currency } = input;
  const copy = CLERK_BID_REFUSAL_COPY;
  const format = (amount: string | number) => formatSaleroomMoney(amount, currency);
  const room = (available: string | null) => {
    if (available == null) return "";
    return Number.parseFloat(available) > 0 ? ` ${copy.room(format(available))}` : "";
  };
  let reason: string;
  switch (refusal.kind) {
    case "organisation":
      reason = `${copy.reason.organisation} ${
        Number.parseFloat(refusal.available) > 0
          ? copy.room(format(refusal.available))
          : copy.noRoom
      }`;
      break;
    case "authorisation_total":
      reason = `${copy.reason.authorisation_total(format(refusal.limit))}${room(refusal.available)}`;
      break;
    default:
      reason = copy.reason[refusal.kind](format(refusal.limit));
  }
  return {
    title: copy.title(input.bidder, format(input.amount)),
    body: `${reason} ${copy.next[refusal.kind]}`,
  };
}
