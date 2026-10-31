import type { ConsignmentStatus } from "./consignment-status";

type Context = {
  /** The member may accept the agreement for the account. */
  canAccept: boolean;
  /** The organisation's name, or `null` for a person's own account. */
  organisation: string | null;
  /** "12 Nov", while an unsold choice is due. */
  chooseBy: string | null;
};

/**
 * "What happens next" on a consignment, one sentence per status, so the seller always knows
 * whose move it is. Closed work has nothing next.
 */
const NEXT: Record<ConsignmentStatus, (context: Context) => string | null> = {
  draft: () => "Finish the details and send them to our specialists. Nothing is sent until you do.",
  in_review: () => "Our specialists are reviewing the work. We reply within 5 working days.",
  needs_changes: () => "Your specialist asked for changes. Make them below and send the work back.",
  agreement: ({ canAccept, organisation }) =>
    canAccept
      ? "Accept the agreement below and we catalogue the work for its sale."
      : `An owner or admin of ${organisation ?? "the account"} accepts the agreement. Then we catalogue the work for its sale.`,
  preparing: () => "We're cataloguing the work for its sale. There is nothing to do.",
  in_sale: () => "The work is catalogued for a sale. We'll tell you how it went.",
  live: () => "The sale is live now.",
  sold: () => "It sold. The money appears in Sold & payouts once the buyer pays.",
  choose_unsold: ({ chooseBy }) =>
    chooseBy
      ? `It did not sell. Choose what happens next by ${chooseBy}.`
      : "It did not sell. Choose what happens next below.",
  unsold: () => "It did not sell. Your choice is with your specialist.",
  not_accepted: () => null,
  withdrawn: () => null,
  cancelled: () => null,
};

export function consignmentNextStep(status: ConsignmentStatus, context: Context): string | null {
  return NEXT[status](context);
}
