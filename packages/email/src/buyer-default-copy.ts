/**
 * The words a person reads about an unpaid purchase: the three payment reminders and the notices
 * that follow a buyer default, for the buyer, the seller and the next bidder. Emails and in-app
 * notices both take their text from here, so a change to a notice (or to what we say about costs
 * and consent, which the lawyer must confirm before launch) is made in one place.
 *
 * Positions these notices state, pending confirmation:
 * - no default costs or interest are charged to the buyer under the current terms;
 * - the seller is told, and asked, before the lot is offered again.
 */

export type PaymentReminderStepKey = "before_due" | "due_day" | "overdue";

export type PaymentReminderCopy = {
  /** The email subject and the in-app title. */
  title: string;
  /** The email heading. */
  heading: string;
  /** Paragraphs, in order. The first is also the in-app message. */
  paragraphs: string[];
};

/** Why an invoice cannot be paid yet: the reminder says what to do instead of "pay now". */
export type PaymentReminderHoldKey = "identity_verification_required" | "organisation_under_review";

type ReminderInput = {
  lotTitle: string;
  amount: string;
  dueDate: string;
  held?: PaymentReminderHoldKey | null;
};

const HELD: Record<PaymentReminderHoldKey, (input: ReminderInput) => PaymentReminderCopy> = {
  identity_verification_required: ({ lotTitle, amount, dueDate }) => ({
    title: `Verify your identity to pay for ${lotTitle}`,
    heading: "Verify your identity to pay",
    paragraphs: [
      `Payment of ${amount} for ${lotTitle} is due on ${dueDate}. Before you can pay, we need to verify your identity.`,
      "It takes a few minutes. Once you are verified you can pay from your purchases.",
    ],
  }),
  organisation_under_review: ({ lotTitle, amount, dueDate }) => ({
    title: `Your invoice for ${lotTitle}`,
    heading: "We are checking your organisation",
    paragraphs: [
      `Payment of ${amount} for ${lotTitle} is due on ${dueDate}. We are still checking your organisation's details, so it cannot be paid yet.`,
      "There is nothing you need to do now. We will let you know as soon as you can pay.",
    ],
  }),
};

const REMINDERS: Record<PaymentReminderStepKey, (input: ReminderInput) => PaymentReminderCopy> = {
  before_due: ({ lotTitle, amount, dueDate }) => ({
    title: `Payment due soon: ${lotTitle}`,
    heading: "Your payment is due soon",
    paragraphs: [
      `Payment of ${amount} for ${lotTitle} is due on ${dueDate}.`,
      "You can pay by card or bank transfer from your purchases. If you have already paid, there is nothing more to do.",
    ],
  }),
  due_day: ({ lotTitle, amount }) => ({
    title: `Payment due today: ${lotTitle}`,
    heading: "Your payment is due today",
    paragraphs: [
      `Payment of ${amount} for ${lotTitle} is due today.`,
      "You can pay by card or bank transfer from your purchases. A bank transfer can take a day to reach us. If you have already paid, thank you.",
    ],
  }),
  overdue: ({ lotTitle, amount, dueDate }) => ({
    title: `Payment overdue: ${lotTitle}`,
    heading: "Your payment is overdue",
    paragraphs: [
      `Payment of ${amount} for ${lotTitle} was due on ${dueDate} and we have not received it.`,
      "Please pay as soon as you can. If something is stopping you, or you have already paid, tell us and we will help. Under our terms we may cancel the sale if payment is not made.",
    ],
  }),
};

export function paymentReminderCopy(
  step: PaymentReminderStepKey,
  input: ReminderInput,
): PaymentReminderCopy {
  return input.held ? HELD[input.held](input) : REMINDERS[step](input);
}

export type BuyerDefaultAudience = "buyer" | "seller" | "underbidder";
export type BuyerDefaultOutcomeKey = "returned_to_inventory" | "offered_to_underbidder";

export type BuyerDefaultCopy = {
  title: string;
  heading: string;
  paragraphs: string[];
};

type DefaultInput = {
  lotTitle: string;
  amount: string;
  outcome: BuyerDefaultOutcomeKey;
  /** Whether the buyer's bidding was paused with the default. */
  buyerRestricted: boolean;
};

/** What we say about cost. Stated to the buyer so they know where they stand. */
export const BUYER_DEFAULT_NO_CHARGES =
  "No fees or interest have been added for this cancellation.";

const SELLER_NEXT: Record<BuyerDefaultOutcomeKey, string> = {
  returned_to_inventory:
    "The lot is back in our inventory. We will be in touch about what happens next, and we will ask you before it is offered again.",
  offered_to_underbidder:
    "We would like to offer the lot to the next highest bidder at their bid. We will ask for your agreement before we do. Reply to the email we send you, or contact us, if you would prefer another route.",
};

export function buyerDefaultCopy(
  audience: BuyerDefaultAudience,
  input: DefaultInput,
): BuyerDefaultCopy {
  const { lotTitle, amount, outcome, buyerRestricted } = input;
  switch (audience) {
    case "buyer":
      return {
        title: `Your purchase was cancelled: ${lotTitle}`,
        heading: "Your purchase has been cancelled",
        paragraphs: [
          `We did not receive payment of ${amount} for ${lotTitle}, so we have cancelled the sale and voided the invoice. You do not owe anything further for this lot.`,
          BUYER_DEFAULT_NO_CHARGES,
          ...(buyerRestricted
            ? ["Bidding on your account is paused while we talk to you about this."]
            : []),
          "If you think this is a mistake, or you would like to talk it through, please contact us.",
        ],
      };
    case "seller":
      return {
        title: `The buyer did not pay: ${lotTitle}`,
        heading: "The buyer did not complete their purchase",
        paragraphs: [
          `The buyer of ${lotTitle} (${amount}) did not pay, and we have cancelled the sale. Nothing is payable to you for this sale.`,
          SELLER_NEXT[outcome],
        ],
      };
    case "underbidder":
      return {
        title: `${lotTitle} may become available`,
        heading: "This lot may become available",
        paragraphs: [
          `The winning bidder did not complete the purchase of ${lotTitle}. We are talking to the seller about what happens next.`,
          "If the lot is offered to you, we will contact you. You do not need to do anything now, and you are not committed to buy.",
        ],
      };
  }
}
