import { LONDON_TIME_ZONE, formatDate, formatTime, toDate } from "@auction/datetime";

/**
 * The words of a re-offer: when a buyer has defaulted and the lot is offered to the next
 * highest bidder at their bid. Emails and in-app notices both take their text from here, so a
 * change (or a change to the binding terms, which the lawyer must confirm) is made in one place.
 *
 * Rules these notices state:
 * - the price is the bidder's highest placed bid, never a hidden maximum (RA6);
 * - a window ends at 17:00 London time on the stated day (RA8);
 * - accepting is binding and only done from the bidder's workspace, never from an email (RA10, RA11);
 * - the invoice is due seven days after acceptance (RA10);
 * - the seller and the bidder never learn who the other is (RA16); only staff see both.
 */

/** Days after acceptance that the invoice falls due. */
export const REOFFER_INVOICE_DUE_DAYS = 7;

export type ReofferNoticeCopy = {
  /** The email subject and the in-app title. */
  title: string;
  /** The email heading. */
  heading: string;
  /** Paragraphs, in order. The first is also the in-app message. */
  paragraphs: string[];
};

function instantOf(instant: string): Date {
  const date = toDate(instant);
  if (!date) throw new Error(`Not a valid instant: ${instant}`);
  return date;
}

/** "17:00 on 15 November 2026": a deadline in London time, as a person reads it. */
export function reofferDeadlineText(instant: string): string {
  const date = instantOf(instant);
  return `${formatTime(date, LONDON_TIME_ZONE)} on ${formatDate(date, LONDON_TIME_ZONE, { month: "long" })}`;
}

/** "15 November 2026": a calendar day in London. */
export function reofferDayText(instant: string): string {
  return formatDate(instantOf(instant), LONDON_TIME_ZONE, { month: "long" });
}

/** The binding terms, summarised beside every offer to a bidder. */
export function reofferBindingTerms(price: string): string[] {
  return [
    `Accepting is binding: you agree to buy the lot at ${price}.`,
    "The price is your highest placed bid. It is never a hidden maximum.",
    `Your invoice will be due ${REOFFER_INVOICE_DUE_DAYS} days after you accept.`,
    "If you do not accept before the offer ends, it lapses and you owe nothing.",
    "You can only accept from your workspace. Nothing in this email accepts for you.",
  ];
}

type SellerConsentInput = { lotTitle: string; price: string; answerBy: string };

export function sellerConsentRequestCopy(input: SellerConsentInput): ReofferNoticeCopy {
  const { lotTitle, price, answerBy } = input;
  return {
    title: `Can we sell ${lotTitle} to the next bidder?`,
    heading: "We would like to sell to the next highest bidder",
    paragraphs: [
      `The buyer of ${lotTitle} did not pay, and the sale was cancelled. We would like to offer the lot to the next highest bidder at ${price}, the highest bid they placed.`,
      `We need your agreement first. Please tell us by ${reofferDeadlineText(answerBy)}. If you would rather not, or would prefer another route, tell us and we will not make the offer.`,
      "The bidder is not named to you, and you are not named to them.",
    ],
  };
}

type OfferInput = { lotTitle: string; price: string; windowEndsAt: string };

export function offerMadeCopy(input: OfferInput): ReofferNoticeCopy {
  const { lotTitle, price, windowEndsAt } = input;
  return {
    title: `An offer to buy ${lotTitle} at ${price}`,
    heading: "The lot is available to you",
    paragraphs: [
      `The winning bidder did not complete the purchase of ${lotTitle}, and the seller has agreed to sell it to you at ${price}, your highest placed bid.`,
      `You have until ${reofferDeadlineText(windowEndsAt)} (London time) to accept or decline, from your workspace.`,
    ],
  };
}

export function offerReminderCopy(input: OfferInput): ReofferNoticeCopy {
  const { lotTitle, price, windowEndsAt } = input;
  return {
    title: `Your offer for ${lotTitle} ends soon`,
    heading: "Your offer ends soon",
    paragraphs: [
      `The offer to buy ${lotTitle} at ${price} ends at ${reofferDeadlineText(windowEndsAt)} (London time).`,
      "Accept or decline from your workspace. If you do nothing, the offer lapses and you owe nothing.",
    ],
  };
}

type AcceptedInput = { lotTitle: string; price: string; invoiceDueAt: string };

export function offerAcceptedCopy(input: AcceptedInput): ReofferNoticeCopy {
  const { lotTitle, price, invoiceDueAt } = input;
  return {
    title: `You have bought ${lotTitle}`,
    heading: "The lot is yours",
    paragraphs: [
      `Thank you for accepting. ${lotTitle} is yours at ${price}.`,
      `Your invoice is ready in your workspace and is due by ${reofferDayText(invoiceDueAt)}, ${REOFFER_INVOICE_DUE_DAYS} days after you accepted.`,
    ],
  };
}

/** How an offer ended without a sale. */
export type ReofferClosedOutcome = "declined" | "expired" | "withdrawn";

type ClosedInput = { lotTitle: string; outcome: ReofferClosedOutcome };

const BIDDER_CLOSED: Record<ReofferClosedOutcome, (lotTitle: string) => ReofferNoticeCopy> = {
  declined: (lotTitle) => ({
    title: `You declined the offer for ${lotTitle}`,
    heading: "You declined the offer",
    paragraphs: [
      `We have recorded that you declined the offer to buy ${lotTitle}. You do not owe anything for it.`,
    ],
  }),
  expired: (lotTitle) => ({
    title: `The offer for ${lotTitle} has ended`,
    heading: "The offer has ended",
    paragraphs: [
      `The time to accept the offer for ${lotTitle} has passed. You do not owe anything for it.`,
    ],
  }),
  withdrawn: (lotTitle) => ({
    title: `The offer for ${lotTitle} was withdrawn`,
    heading: "The offer was withdrawn",
    paragraphs: [
      `The offer to buy ${lotTitle} has been withdrawn, so it can no longer be accepted. You do not owe anything for it.`,
    ],
  }),
};

export function offerClosedCopy(input: ClosedInput): ReofferNoticeCopy {
  return BIDDER_CLOSED[input.outcome](input.lotTitle);
}

/** What staff are told: the same four outcomes, with the bidder named (RA16). */
export type ReofferStaffOutcome = "accepted" | ReofferClosedOutcome;

type StaffInput = {
  lotTitle: string;
  price: string;
  bidderName: string;
  outcome: ReofferStaffOutcome;
};

const STAFF_VERB: Record<ReofferStaffOutcome, string> = {
  accepted: "accepted",
  declined: "declined",
  expired: "let lapse",
  withdrawn: "had their offer withdrawn for",
};

const STAFF_NEXT: Record<ReofferStaffOutcome, string> = {
  accepted: "The lot has been re-awarded and a new unpaid sale created. The seller has been told.",
  declined:
    "The offer is closed. You can offer the lot to the next bidder or return it to inventory.",
  expired:
    "The offer is closed. You can offer the lot to the next bidder or return it to inventory.",
  withdrawn: "The offer is closed and the bidder has been told.",
};

export function reofferStaffCopy(input: StaffInput): ReofferNoticeCopy {
  const { lotTitle, price, bidderName, outcome } = input;
  const verb = STAFF_VERB[outcome];
  return {
    title: `Re-offer ${outcome}: ${lotTitle}`,
    heading: `Re-offer ${outcome}`,
    paragraphs: [
      `${bidderName} ${verb} the re-offer of ${lotTitle} at ${price}.`,
      STAFF_NEXT[outcome],
    ],
  };
}

export type ReofferSellerOutcome = "accepted" | "not_accepted";

type SellerOutcomeInput = { lotTitle: string; price: string; outcome: ReofferSellerOutcome };

export function sellerOutcomeCopy(input: SellerOutcomeInput): ReofferNoticeCopy {
  const { lotTitle, price, outcome } = input;
  if (outcome === "accepted") {
    return {
      title: `${lotTitle} has been sold`,
      heading: "The lot has been sold",
      paragraphs: [
        `The next highest bidder accepted the offer, and ${lotTitle} is sold at ${price}.`,
        "We will be in touch about payment to you once the buyer has paid.",
      ],
    };
  }
  return {
    title: `The offer for ${lotTitle} did not lead to a sale`,
    heading: "The offer did not lead to a sale",
    paragraphs: [
      `The offer to sell ${lotTitle} to the next highest bidder at ${price} did not lead to a sale.`,
      "We will be in touch about what happens next, and we will ask you before the lot is offered again.",
    ],
  };
}
