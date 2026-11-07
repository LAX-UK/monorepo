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
  underButton: "You finish on a secure payment page. Nothing is charged until you confirm there.",
  conditionsLine: "By paying you complete this purchase under the ",
  conditionsLink: "Conditions of Business",
  conditionsTail: " you accepted when you registered to bid.",
  howYouPay: "How you pay",
  methodCard: "Card",
  methodCardNote: "Visa, Mastercard, Amex. Your bank may ask you to confirm.",
  methodBank: "UK bank transfer",
  methodBankNote: "You get our account details and a reference. No card fees.",
  /** `limit` is the server's card limit, formatted. */
  cardLimit: (limit: string) =>
    `Card payments go up to ${limit}. Pick fewer invoices to pay by card.`,
  bankUnderButton:
    "We give you our account details and a reference for this payment. Your invoices are marked paid once all of the money has arrived.",
  tryAgain: "Try again",
  tryAgainTotal: (total: string) => `Try again · ${total}`,
  overOnlineLimit:
    "The total is more than one online payment can take. Pick fewer invoices to pay now.",
  openPurchases: "Open purchases",
  startFailed: "We couldn't open the secure payment page. Nothing was charged.",
  planChanged: (total: string) => `The total has changed to ${total}. Check it and pay again.`,
  planChangedUnread: "The total has changed. Check it and pay again.",
  planChangedLots: "The invoices in this payment have changed. Check them and pay again.",
  emptyTitle: "Nothing to pay",
  tooManyTitle: "Choose fewer invoices",
  emptyCancelled:
    "The sale of these lots did not go ahead, so there is nothing to pay. Your purchases show where each one stands.",
  emptyVoided:
    "The invoice for these lots was cancelled, so there is nothing to pay. Your purchases show where each one stands.",
  emptyRefunded:
    "These payments were refunded, so there is nothing left to pay. Your purchases show where each one stands.",
  emptyDone:
    "Nothing is left to pay on these lots: they are paid, cancelled or refunded. Your purchases show where each one stands.",
  openTitle: "A payment for this is already open",
  openBody: "Finish it on the secure payment page, or try again later.",
  openBadge: "Payment open",
  notYoursOne: "One lot in this link isn't yours to pay",
  notYoursMany: (count: number) => `${count} lots in this link aren't yours to pay`,
  notYoursDetailOne:
    "It was won for another account, or it's already paid. We've left it out; the rest are below.",
  notYoursDetailMany:
    "They were won for another account, or are already paid. We've left them out; the rest are below.",
  overdueTitle: (date: string) => `Payment was due on ${date}. Please pay now.`,
  overdueBody: "If something is stopping you, contact settlements and we'll help.",
  contactSettlements: "Contact settlements",
  openFailedTitle: "We couldn't open the secure payment page",
  openFailedBody: "Nothing was charged. Check your connection and try again.",
  notCompletedTitle: "Payment not completed. You were not charged.",
  notCompletedBody:
    "Your bank's check (3D Secure) was not finished, or the card was declined. Try again, use another card, or pay by UK bank transfer.",
  verifyToPay: "Verify your identity to pay",
  backToPurchase: "Back to purchase",
  backToPurchases: "Back to purchases",
  wonOn: (date: string) => `Won ${date}`,
  wonByFor: (member: string, organisation: string) => `Won by ${member} for ${organisation}`,
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
  confirmingLiveBody:
    "This usually takes under a minute and this page updates by itself. Please don't pay again.",
  stillConfirmingTitle: "Still confirming",
  stillConfirmingBody:
    "Your bank has taken the payment and we're waiting for confirmation. Please don't pay again.",
  confirmingBadge: "Confirming payment",
  beingPaid: "Being paid",
  refresh: "Refresh",
  transferBadge: "Waiting for your transfer",
  partBadge: "Part received",
  transferPanelTitle: "Send a UK bank transfer",
  transferToSend: "To send",
  transferLeftToSend: "Left to send",
  transferTotal: "Total",
  transferReceived: "Received",
  transferAmount: "Amount to send",
  transferAccountName: "Account name",
  transferSortCode: "Sort code",
  transferAccountNumber: "Account number",
  transferReference: "Reference",
  transferNote:
    "Use the reference exactly, so we can match your money. Transfers usually arrive within 2 hours, and we email you when it does. These details come from our payment provider.",
  transferUnavailable:
    "We couldn't load the bank details just now. We also emailed them to you. If you can't find them, contact settlements.",
  transferSubtitle: (count: number) => `One bank transfer for ${count} lots`,
  partTitle: (received: string, total: string) => `${received} of ${total} received`,
  partBody: (remaining: string) =>
    `Send the remaining ${remaining} with the same reference. Your invoices are marked paid together once all of it has arrived.`,
  receivedShare: (percent: number) => `${percent}% received`,
  referenceCaption: (reference: string) => `Reference ${reference}`,
  copy: "Copy",
  copied: (what: string) => `${what} copied`,
  copyLabel: (what: string) => `Copy ${what.toLowerCase()}`,
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
