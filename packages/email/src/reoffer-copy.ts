import { LONDON_TIME_ZONE, formatDate, formatTime, toDate } from "@auction/datetime";
import { formatMoneyMajor } from "./format-money.js";

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

/** Whose stock the lot is. LAX-owned lots need no seller agreement, so the words differ. */
export type ReofferSellerKind = "seller" | "lax_owned";

/** An amount in major units ("1200.00") with its ISO currency, formatted by `formatMoneyMajor`. */
export type ReofferMoney = { amount: string; currency: string };

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

/** "£1,200.00": a placed-bid price as the shared money formatter shows it. */
export function reofferPriceText(money: ReofferMoney): string {
  const text = formatMoneyMajor(money.amount, money.currency);
  if (text === null) throw new Error(`Not a valid amount: ${money.amount}`);
  return text;
}

/** "17:00 (London time) on 15 November 2026": a deadline, as a person reads it. */
export function reofferDeadlineText(instant: string): string {
  const date = instantOf(instant);
  return `${formatTime(date, LONDON_TIME_ZONE)} (London time) on ${formatDate(date, LONDON_TIME_ZONE, { month: "long" })}`;
}

/** "15 November 2026": a calendar day in London. */
export function reofferDayText(instant: string): string {
  return formatDate(instantOf(instant), LONDON_TIME_ZONE, { month: "long" });
}

/** The binding terms, summarised beside every offer to a bidder. */
export function reofferBindingTerms(price: ReofferMoney): string[] {
  return [
    `Accepting is binding: you agree to buy the lot at ${reofferPriceText(price)}.`,
    "The price is your highest placed bid. It is never a hidden maximum.",
    `Your invoice will be due ${REOFFER_INVOICE_DUE_DAYS} days after you accept.`,
    "If you do not accept before the offer ends, it lapses and you owe nothing.",
    "You can only accept from your workspace. Nothing in this email accepts for you.",
  ];
}

type SellerConsentInput = { lotTitle: string; placedBidPrice: ReofferMoney; answerBy: string };

export function sellerConsentRequestCopy(input: SellerConsentInput): ReofferNoticeCopy {
  const { lotTitle, answerBy } = input;
  const price = reofferPriceText(input.placedBidPrice);
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

/** The one reminder to the seller, if they have not yet answered the request. */
export function sellerConsentReminderCopy(input: SellerConsentInput): ReofferNoticeCopy {
  const { lotTitle, answerBy } = input;
  const price = reofferPriceText(input.placedBidPrice);
  return {
    title: `Reminder: can we sell ${lotTitle} to the next bidder?`,
    heading: "We are still waiting for your answer",
    paragraphs: [
      `We are still waiting for your answer about offering ${lotTitle} to the next highest bidder at ${price}, the highest bid they placed. Please tell us by ${reofferDeadlineText(answerBy)}.`,
      "If we do not hear from you by then, we will not make the offer. If you would rather not, or would prefer another route, tell us.",
      "The bidder is not named to you, and you are not named to them.",
    ],
  };
}

type OfferInput = { lotTitle: string; placedBidPrice: ReofferMoney; windowEndsAt: string };
type OfferMadeInput = OfferInput & { sellerKind: ReofferSellerKind };

export function offerMadeCopy(input: OfferMadeInput): ReofferNoticeCopy {
  const { lotTitle, windowEndsAt, sellerKind } = input;
  const price = reofferPriceText(input.placedBidPrice);
  const offered =
    sellerKind === "lax_owned"
      ? `we are offering it to you at ${price}, your highest placed bid`
      : `the seller has agreed to sell it to you at ${price}, your highest placed bid`;
  return {
    title: `An offer to buy ${lotTitle} at ${price}`,
    heading: "The lot is available to you",
    paragraphs: [
      `The winning bidder did not complete the purchase of ${lotTitle}, and ${offered}. You have until ${reofferDeadlineText(windowEndsAt)} to accept or decline, from your workspace.`,
    ],
  };
}

export function offerReminderCopy(input: OfferInput): ReofferNoticeCopy {
  const { lotTitle, windowEndsAt } = input;
  const price = reofferPriceText(input.placedBidPrice);
  return {
    title: `Your offer for ${lotTitle} ends soon`,
    heading: "Your offer ends soon",
    paragraphs: [
      `The offer to buy ${lotTitle} at ${price} ends at ${reofferDeadlineText(windowEndsAt)}.`,
      "Accept or decline from your workspace. If you do nothing, the offer lapses and you owe nothing.",
    ],
  };
}

type AcceptedInput = { lotTitle: string; placedBidPrice: ReofferMoney; invoiceDueAt: string };

export function offerAcceptedCopy(input: AcceptedInput): ReofferNoticeCopy {
  const { lotTitle, invoiceDueAt } = input;
  const price = reofferPriceText(input.placedBidPrice);
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
  placedBidPrice: ReofferMoney;
  bidderName: string;
  outcome: ReofferStaffOutcome;
  sellerKind: ReofferSellerKind;
};

const CLOSED_NEXT =
  "The offer is closed. You can offer the lot to the next bidder or return it to inventory.";

export function reofferStaffCopy(input: StaffInput): ReofferNoticeCopy {
  const { lotTitle, bidderName, outcome, sellerKind } = input;
  const price = reofferPriceText(input.placedBidPrice);
  const sentence: Record<ReofferStaffOutcome, string> = {
    accepted: `${bidderName} accepted the re-offer of ${lotTitle} at ${price}.`,
    declined: `${bidderName} declined the re-offer of ${lotTitle} at ${price}.`,
    expired: `${bidderName} let the re-offer of ${lotTitle} at ${price} lapse.`,
    withdrawn: `The re-offer of ${lotTitle} to ${bidderName} at ${price} was withdrawn.`,
  };
  const next: Record<ReofferStaffOutcome, string> = {
    accepted: `The lot has been re-awarded and a new unpaid sale created.${
      sellerKind === "seller" ? " The seller has been told." : ""
    }`,
    declined: CLOSED_NEXT,
    expired: CLOSED_NEXT,
    withdrawn: "The offer is closed and the bidder has been told.",
  };
  return {
    title: `Re-offer ${outcome}: ${lotTitle}`,
    heading: `Re-offer ${outcome}`,
    paragraphs: [sentence[outcome], next[outcome]],
  };
}

export type ReofferSellerOutcome = "accepted" | "not_accepted";

type SellerOutcomeInput = {
  lotTitle: string;
  placedBidPrice: ReofferMoney;
  outcome: ReofferSellerOutcome;
};

export function sellerOutcomeCopy(input: SellerOutcomeInput): ReofferNoticeCopy {
  const { lotTitle, outcome } = input;
  const price = reofferPriceText(input.placedBidPrice);
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
