import type { InvoiceLineKind, PayPlanLeftOutReason } from "@auction/types";

/** The names of the lines when several invoices are summed per kind (a single lot shows its own). */
export const INVOICE_LINE_KIND_LABEL: Record<InvoiceLineKind, string> = {
  hammer: "Hammer price",
  buyers_premium: "Buyer's premium",
  vat_on_hammer: "VAT on hammer",
  import_vat: "Import VAT",
  artists_resale_right: "Artist's Resale Right",
  delivery: "Delivery",
  legacy_total: "Invoice total",
};

/**
 * Why a lot of the link is not in the payment, said of one lot and of several. A lot is only ever
 * named by its reason: the plan does not carry the title of a lot it leaves out.
 */
export const LEFT_OUT_REASON_COPY: Record<PayPlanLeftOutReason, { one: string; many: string }> = {
  other_account: {
    one: "was won for another account",
    many: "were won for another account",
  },
  paid: { one: "is already paid", many: "are already paid" },
  being_confirmed: {
    one: "has a payment being confirmed",
    many: "have a payment being confirmed",
  },
  not_payer: {
    one: "is not one your role pays",
    many: "are not ones your role pays",
  },
  held_for_review: {
    one: "is in review and can be paid once we have checked it",
    many: "are in review and can be paid once we have checked them",
  },
  being_paid: {
    one: "is already in another payment",
    many: "are already in another payment",
  },
  cancelled: { one: "was cancelled", many: "were cancelled" },
  refunded: { one: "was refunded", many: "were refunded" },
  voided: { one: "has a cancelled invoice", many: "have a cancelled invoice" },
};

export const PAY_COPY = {
  titleEmpty: "Pay",
  titleSeveral: (count: number) => `Pay ${count} invoices`,
  titleOne: (lotTitle: string) => `Pay for ${lotTitle}`,
  severalSubtitle: (count: number) => `One payment for ${count} lots you won`,
  payingFor: (organisation: string) => `Paying for ${organisation}`,
  panelLot: "Lot",
  panelLots: (count: number) => `Lots (${count} ${count === 1 ? "invoice" : "invoices"})`,
  panelPayment: "Payment",
  panelDelivery: "Delivery",
  deliveryTitle: "Choose after paying",
  deliveryNote: "Collect in London, insured courier or your own shipper. You choose after paying.",
  invoiceFrom: (company: string, address: string) => `Invoice from ${company}, ${address}`,
  totalToPay: "Total to pay",
  dueBy: (date: string) => `Due by ${date}`,
  wasDue: (date: string) => `Was due ${date}`,
  badgeDue: (date: string) => `Due ${date}`,
  badgeFirstDue: (date: string) => `First due ${date}`,
  badgeOverdue: (date: string) => `Overdue since ${date}`,
  payLabel: (total: string) => `Pay ${total}`,
  payForOrganisation: (total: string, organisation: string) => `Pay ${total} for ${organisation}`,
  payBar: "Pay",
  continueBar: "Continue",
  continueToBankTransfer: "Continue to bank transfer",
  opening: "Opening secure payment…",
  tryAgain: "Try again",
  underButton: "You finish on our secure payment page. Nothing is charged until you confirm there.",
  conditionsLine: "By paying you complete this purchase under the ",
  conditionsLink: "Conditions of Business",
  conditionsTail: " you accepted when you registered to bid.",
  howYouPay: "How you pay",
  card: "Card: Visa, Mastercard, Amex. Your bank may ask you to confirm.",
  bankTransfer: "UK bank transfer: you get our account details and a reference. No card fees.",
  cardLimit: "Card payments have a limit. Pick fewer invoices to pay by card.",
  overOnlineLimit:
    "The total is more than one online payment can take. Pick fewer invoices to pay now.",
  openPurchases: "Open purchases",
  startFailed: "We couldn't open the secure payment page. Nothing was charged.",
  planChanged: (total: string) => `The total has changed to ${total}. Check it and pay again.`,
  planChangedUnread: "The total has changed. Check it and pay again.",
  planChangedLots: "The invoices in this payment have changed. Check them and pay again.",
  emptyTitle: "Nothing to pay",
  tooManyTitle: "Choose fewer invoices",
  emptyAllPaid:
    "Every invoice is paid. Lots you win appear in Purchases with their invoice, ready to pay here.",
  emptyNoLots:
    "Choose the invoices to pay in Purchases. Lots you win appear there with their invoice, ready to pay here.",
  emptyInvalid:
    "This link doesn't name any lots. Open Purchases and choose the invoices to pay from there.",
  emptyTooMany: "A payment covers up to 20 invoices. Choose fewer in Purchases.",
  emptyNotYours:
    "None of the lots in this link can be paid from this account. They were won for another account, or are already paid.",
  confirmingTitle: "Confirming your payment",
  confirmingBody:
    "This usually takes under a minute. Refresh to see it update. Please don't pay again.",
  confirmingBadge: "Confirming payment",
  refresh: "Refresh",
  inReviewBadge: "In review",
  financeCheckBadge: "Finance check",
  identityBadge: "Identity needed",
  setupBadge: "Setup needed",
  unavailableBadge: "Not available",
  awaitingBadge: "Awaiting payment",
} as const;

/** One notice for each check that can stop a payment: the approved wording and the next step. */
export const GATE_COPY = {
  identity: {
    title: "Verify your identity to pay",
    detail:
      "We check every buyer once before their first payment. It takes about 5 minutes with a passport or driving licence.",
    action: "Verify identity",
    after: "You can pay as soon as your identity is verified. We'll email you.",
  },
  sourceOfFunds: {
    title: "We need to confirm the source of funds before you pay",
    detail:
      "The law asks us to check where the money for some purchases comes from. Upload a recent bank statement, or proof of a sale or inheritance that funded it. We reply within 2 working days.",
    action: "Provide documents",
  },
  buyerCheck: {
    title: "We're checking a few details before this can be paid",
    detail: "We'll email you when it's done.",
  },
  amlHold: {
    title: "We're checking a few details before you can pay",
    detail: "We'll email you when it's done.",
  },
  financeCheck: {
    title: "Our finance team sets up payments of this size with you",
    detail:
      "For payments of £500,000 or more we confirm the details by phone before you pay. Expect a call or email within 1 working day.",
  },
  heldForReview: {
    title: "Our team is checking this invoice",
    detail: "Once they have, you can pay here. Refresh this page after you hear from us.",
  },
  organisationUnderReview: {
    title: "We're still checking your organisation's details",
    detail: "You can pay here once we have. We'll let you know.",
  },
  organisationClosed: {
    title: "This organisation can't make payments",
    detail: "Contact client services and we'll help.",
    action: "Contact client services",
  },
  onboarding: {
    title: "Finish setting up your account before you pay",
    detail: "It takes a couple of minutes, and then you can pay here.",
    action: "Finish setting up",
  },
  informed: (organisation: string) => ({
    title: `${organisation} pays for this lot`,
    detail:
      "Its owners, admins and finance team pay for lots you win for it. You'll see it move on here once they have.",
  }),
  notPayer: {
    title: "Your role doesn't pay these invoices",
    detail:
      "The account's owners, admins and finance team pay. You'll see it move on once they have.",
  },
} as const;
