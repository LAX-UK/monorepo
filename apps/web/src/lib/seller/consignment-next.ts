import type { SoldLot } from "@/lib/data/http/workspace-selling.schema";
import { SPECIALIST_RESPONSE_PROMISE } from "@/lib/marketing/sell-flow-copy";
import { formatDate } from "@/lib/ui/format";
import type { AgreementAcceptanceHold } from "@auction/domain";
import { consignmentMessagesHref } from "./consignment-records";
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
  /** The sold work's payout state; `null` when this member does not see payouts. */
  sold?: SoldPayout | null;
};

/** What "What happens next" needs from a sold lot's row in Sold & payouts. */
export type SoldPayout = Pick<SoldLot, "stage" | "payout">;

type SoldStep = { text: (sold: SoldPayout) => string; link: boolean };

/** One entry per stage of a sold lot, so the sentence follows the real payout. */
const SOLD_STEP: Record<SoldPayout["stage"], SoldStep> = {
  buyer_paying: {
    text: () => "It sold. The money appears in Sold & payouts once the buyer pays.",
    link: false,
  },
  paid_by_buyer: {
    text: () => "It sold and the buyer has paid. Your payout will be scheduled soon.",
    link: false,
  },
  in_payout: {
    text: () => "It sold and the buyer has paid. Your payout is scheduled.",
    link: true,
  },
  paid_out: {
    text: ({ payout }) =>
      payout?.settledAt
        ? `It sold and was paid out on ${formatDate(payout.settledAt)}.`
        : "It sold and was paid out.",
    link: true,
  },
  payout_problem: {
    text: () => "It sold, but there is a problem with the payout.",
    link: false,
  },
  refunded: {
    text: () => "It sold, but the buyer's payment was refunded, so there is no payout.",
    link: false,
  },
};

const SOLD_UNKNOWN = "It sold. Payout details are shown to people who see the account's payouts.";

/**
 * The link that follows the sentence: the payout once it exists, or the consignment's messages
 * when the payout has a problem and the seller needs to talk to their specialist.
 */
export function consignmentNextLink(
  status: ConsignmentStatus,
  context: Pick<Context, "sold"> & { submissionId: string },
): { label: string; href: string } | null {
  const { sold, submissionId } = context;
  if (status !== "sold" || !sold) return null;
  if (sold.stage === "payout_problem") {
    return {
      label: "Message your specialist about this payout",
      href: consignmentMessagesHref(submissionId),
    };
  }
  if (!sold.payout || !SOLD_STEP[sold.stage].link) return null;
  return { label: "View payout", href: `/selling/payouts/${encodeURIComponent(sold.payout.id)}` };
}

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
  in_review: () => `Our specialists are reviewing the work. ${SPECIALIST_RESPONSE_PROMISE}`,
  // The request and its one action are on the page itself.
  needs_changes: () => null,
  agreement: ({ canAccept, organisation, acceptHold }) =>
    acceptHold
      ? agreementHoldCopy(acceptHold, organisation)
      : canAccept
        ? "Accept the agreement below and we catalogue the work for its sale."
        : `An owner or admin of ${organisation ?? "the account"} accepts the agreement. Then we catalogue the work for its sale.`,
  preparing: () => "We're cataloguing the work for its sale. There is nothing to do.",
  in_sale: () => "The work is catalogued for a sale. We'll tell you how it went.",
  live: () => "The sale is live now.",
  sold: ({ sold }) => (sold ? SOLD_STEP[sold.stage].text(sold) : SOLD_UNKNOWN),
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
