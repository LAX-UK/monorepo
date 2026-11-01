import type { AgreementAcceptanceHold } from "@auction/domain";
import type { ConsignmentStatus } from "./consignment-status";

type Context = {
  /** The member may accept the agreement for the account (their role). */
  canAccept: boolean;
  /** The organisation's name, or `null` for a person's own account. */
  organisation: string | null;
  /** "12 Nov", while an unsold choice is due. */
  chooseBy: string | null;
  /** Why the account's state holds accepting, whoever the member is; `null` while it allows it. */
  acceptHold?: AgreementAcceptanceHold | null;
};

/**
 * Why the agreement cannot be accepted yet, said from the account's state rather than the
 * member's role: nobody in a paused organisation can accept, so naming owners would mislead.
 */
const HOLD_COPY: Record<AgreementAcceptanceHold, (account: string) => string> = {
  paused: (account) =>
    `Selling is paused for ${account}, so the agreement can't be accepted for now. Contact us to find out why and when it resumes.`,
  checking: (account) =>
    `The agreement can be accepted once we've checked ${account}'s documents. Then we catalogue the work for its sale.`,
  payouts: (account) =>
    `The agreement can be accepted once payouts are set up for ${account}. Then we catalogue the work for its sale.`,
  closed: (account) => `The agreement can't be accepted because ${account} is closed.`,
};

/** The short line in place of the acceptance on the agreement itself. */
const HOLD_LINE: Record<AgreementAcceptanceHold, (account: string) => string> = {
  paused: (account) => `Accepting is paused for ${account}.`,
  checking: (account) => `Accepting opens once we've checked ${account}'s documents.`,
  payouts: (account) => `Accepting opens once payouts are set up for ${account}.`,
  closed: (account) => `This agreement can't be accepted because ${account} is closed.`,
};

function holdAccount(organisation: string | null): string {
  return organisation ?? "your account";
}

/** The sentence for an agreement on hold, for "What happens next". */
export function agreementHoldCopy(hold: AgreementAcceptanceHold, organisation: string | null) {
  return HOLD_COPY[hold](holdAccount(organisation));
}

/** The line that replaces the acceptance on an agreement on hold. */
export function agreementHoldLine(hold: AgreementAcceptanceHold, organisation: string | null) {
  return HOLD_LINE[hold](holdAccount(organisation));
}

/**
 * "What happens next" on a consignment, one sentence per status, so the seller always knows
 * whose move it is. Closed work has nothing next.
 */
const NEXT: Record<ConsignmentStatus, (context: Context) => string | null> = {
  draft: () => "Finish the details and send them to our specialists. Nothing is sent until you do.",
  in_review: () => "Our specialists are reviewing the work. We reply within 5 working days.",
  needs_changes: () => "Your specialist asked for changes. Make them below and send the work back.",
  agreement: ({ canAccept, organisation, acceptHold }) =>
    acceptHold
      ? agreementHoldCopy(acceptHold, organisation)
      : canAccept
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
