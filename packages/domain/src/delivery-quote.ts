/**
 * A courier quote for delivering a won lot. The buyer asks for one, the saleroom team prices it,
 * and the buyer accepts it; until it is accepted either side can start again.
 *
 *   requested ──quote──▶ quoted ──accept──▶ accepted
 *       │  ▲                │ ▲ requote
 *       │  └────request─────┼─┘
 *       └──withdraw──▶ withdrawn ◀──withdraw──┘
 *
 * An accepted quote is final: the delivery is booked and the price joins what the buyer owes.
 */
export const DELIVERY_QUOTE_STATUSES = ["requested", "quoted", "accepted", "withdrawn"] as const;
export type DeliveryQuoteStatus = (typeof DELIVERY_QUOTE_STATUSES)[number];

export type DeliveryQuoteAction = "request" | "quote" | "accept" | "withdraw";

/** Who takes each step: the buyer's payers, or the saleroom team. */
export type DeliveryQuoteActor = "buyer" | "staff";

type Step = {
  actor: DeliveryQuoteActor;
  from: readonly (DeliveryQuoteStatus | null)[];
  to: DeliveryQuoteStatus;
};

/** The one table of moves. A missing quote is `null`; asking again after a withdrawal is allowed. */
const STEPS: Record<DeliveryQuoteAction, Step> = {
  request: { actor: "buyer", from: [null, "withdrawn"], to: "requested" },
  quote: { actor: "staff", from: ["requested", "quoted"], to: "quoted" },
  accept: { actor: "buyer", from: ["quoted"], to: "accepted" },
  withdraw: { actor: "buyer", from: ["requested", "quoted"], to: "withdrawn" },
};

export type DeliveryQuoteRefusal =
  /** The step is not open from the quote's current state. */
  | "quote_step_not_allowed"
  /** The other side takes this step. */
  | "quote_wrong_actor";

export type DeliveryQuoteDecision =
  | { allowed: true; next: DeliveryQuoteStatus }
  | { allowed: false; reason: DeliveryQuoteRefusal };

/** Whether `actor` may take `action` on a quote in `current` (`null`: none yet), and where it lands. */
export function deliveryQuoteTransition(
  current: DeliveryQuoteStatus | null,
  action: DeliveryQuoteAction,
  actor: DeliveryQuoteActor,
): DeliveryQuoteDecision {
  const step = STEPS[action];
  if (step.actor !== actor) return { allowed: false, reason: "quote_wrong_actor" };
  if (!step.from.includes(current)) return { allowed: false, reason: "quote_step_not_allowed" };
  return { allowed: true, next: step.to };
}

/** The steps open to `actor` on a quote in `current`, so a screen offers only what will work. */
export function deliveryQuoteActionsFor(
  current: DeliveryQuoteStatus | null,
  actor: DeliveryQuoteActor,
): DeliveryQuoteAction[] {
  return (Object.keys(STEPS) as DeliveryQuoteAction[]).filter(
    (action) => deliveryQuoteTransition(current, action, actor).allowed,
  );
}
