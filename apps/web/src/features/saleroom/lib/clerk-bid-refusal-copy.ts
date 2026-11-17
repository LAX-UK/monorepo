import { formatSaleroomMoney } from "@/features/saleroom/lib/format-saleroom-money";

/** Which limit stopped a bid the clerk placed, as the API names it. */
export type ClerkBidLimitKind =
  | "paddle"
  | "telephone"
  | "per_lot"
  | "authorisation_total"
  | "organisation";

/** A paddle or telephone bid a limit refused: the limit and, for a shared limit, the room left. */
export type ClerkBidLimitRefusal = {
  kind: ClerkBidLimitKind;
  /** Pounds, as a decimal string. */
  limit: string;
  available: string | null;
};

const KINDS = new Set<string>([
  "paddle",
  "telephone",
  "per_lot",
  "authorisation_total",
  "organisation",
]);
const MONEY = /^\d+(\.\d{1,2})?$/;

/** The refusal in an API answer, or `null` when the answer is not a limit refusal. */
export function readClerkBidLimitRefusal(value: unknown): ClerkBidLimitRefusal | null {
  if (!value || typeof value !== "object") return null;
  const { kind, limit, available } = value as Record<string, unknown>;
  if (typeof kind !== "string" || !KINDS.has(kind)) return null;
  if (typeof limit !== "string" || !MONEY.test(limit)) return null;
  return {
    kind: kind as ClerkBidLimitKind,
    limit,
    available: typeof available === "string" && MONEY.test(available) ? available : null,
  };
}

const OWNERS_RAISE =
  "Take a bid within the limit. Only the organisation's owners or admins can raise it.";

/**
 * What the clerk is told when a limit refused a paddle or telephone bid: whose bid, which limit
 * and how much it allows, and what to do next. Shown as a Notice by the bid form until the clerk
 * changes the bid, never as a toast.
 */
export function clerkBidRefusalNotice(input: {
  refusal: ClerkBidLimitRefusal;
  /** "Paddle 142", or the telephone bidder's name. */
  bidder: string;
  amount: number;
  currency: string;
}): { title: string; body: string } {
  const { refusal, currency } = input;
  const money = (amount: string | number) => formatSaleroomMoney(amount, currency);
  const limit = money(refusal.limit);
  const room =
    refusal.available != null && Number.parseFloat(refusal.available) > 0
      ? ` They can bid up to ${money(refusal.available)} on this lot.`
      : "";
  const reason: Record<ClerkBidLimitKind, string> = {
    paddle: `The paddle's limit for this sale is ${limit}.`,
    telephone: `The telephone booking allows bids up to ${limit}.`,
    per_lot: `Their buyer agent authorisation allows up to ${limit} a lot.`,
    authorisation_total: `It would take them past the ${limit} their buyer agent authorisation allows in total.${room}`,
    organisation: `It would take their organisation past its bidding limit of ${limit}.${room}`,
  };
  const next: Record<ClerkBidLimitKind, string> = {
    paddle:
      "Take a bid within the limit. To bid higher, the bidder's limit for this sale must be raised first.",
    telephone:
      "Take a bid within the limit. To bid higher, the booking's maximum must be raised first.",
    per_lot: OWNERS_RAISE,
    authorisation_total: OWNERS_RAISE,
    organisation: OWNERS_RAISE,
  };
  return {
    title: `${input.bidder}'s bid of ${money(input.amount)} wasn't placed`,
    body: `${reason[refusal.kind]} ${next[refusal.kind]}`,
  };
}
