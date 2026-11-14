import type { BillToContext } from "@auction/types";
import type { EmailMoment, ZoneNote } from "./moment.js";
import type { StoredEmailAttachment, TemplateDomainSlice } from "./shared.js";

const names = [
  "payment-receipt",
  "payment-invoice",
  "bid-invoice-issued",
  "payment-refund-notice",
  "payment-manual-review-buyer-notice",
  "payment-failed-notice",
  "payment-reminder",
  "buyer-default-notice",
  "payment-manual-review-admin-notice",
  "payment-unapplied-money-admin-notice",
  "dispute-opened-notice",
  "dispute-closed-notice",
] as const;

type PaymentTemplateName = (typeof names)[number];

type PaymentTemplateVars = {
  "payment-receipt": {
    userName?: string | null;
    lotTitle: string;
    /** Formatted for display ("£1,250.00"); left out when the amount is unknown. */
    amount?: string | null;
    receiptUrl?: string | null;
    /**
     * Each invoice a single payment settled ("Lot 12 · Title", "£1,250.00"), when it settled
     * more than one; `amount` is then the total.
     */
    lines?: { title: string; amount: string }[] | null;
    /** How it was paid, in words ("Card", "Bank transfer"). */
    paymentMethod?: string | null;
  };
  "payment-invoice": {
    userName?: string | null;
    invoiceNumber: string;
    amount: string;
    invoiceUrl: string;
    billTo: BillToContext;
    dueDate?: string;
  };
  /**
   * "Your invoice": the invoice Books issued for a Bid purchase, with LAX's stored copy of its PDF
   * attached. Sent once per issued invoice, never for a rehearsal. Every figure is formatted by
   * the sender from the invoice's frozen lines.
   */
  "bid-invoice-issued": {
    userName?: string | null;
    invoiceNumber: string;
    lotTitle: string;
    /** "£1,543.20". */
    total: string;
    /** Paid (with the moment, "Thu 12 Nov, 14:05 GMT") or still due (by the end of that day). */
    settlement: { kind: "paid"; on: string } | { kind: "due"; by: string };
    /** LAX's stored copy, read from document storage at send time; nothing is stored twice. */
    storedAttachment: StoredEmailAttachment;
    purchaseUrl: string;
  };
  /** notify seller entity members when a payment is refunded or dispute is lost. */
  "payment-refund-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    lotTitle: string;
    lotReference?: string | null;
    refundAmount: string;
    refundCurrency: string;
    /** 'refund' | 'dispute_lost' */
    eventKind: string;
    /** Optional reason from Stripe (e.g. dispute reason). */
    reason?: string | null;
    supportContactEmail: string;
  };
  /** The buyer's bank did not complete a delayed payment; says how to pay again. */
  "payment-failed-notice": {
    userName?: string | null;
    lotTitle: string;
    /** Checkout for this lot. */
    payUrl: string;
    supportContactEmail: string;
  };
  /** One of the three reminders for an unpaid invoice. */
  "payment-reminder": {
    userName?: string | null;
    step: "before_due" | "due_day" | "overdue";
    lotTitle: string;
    /** Formatted for display ("£1,250.00"). */
    amount: string;
    /** The due date in words ("10 November 2026"). */
    dueDate: string;
    /** When it is due: the end of the London day, then the recipient's local time if different. */
    due?: EmailMoment | null;
    /** Where the local time comes from; present only when a local time is shown. */
    zoneNote?: ZoneNote | null;
    /** Checkout for this lot. */
    payUrl: string;
    supportContactEmail: string /** The invoice cannot be paid yet; the email says what to do instead of "Pay now". */;
    held?: "identity_verification_required" | "organisation_under_review" | null;
    /** Where the held step is done (identity verification). */
    actionUrl?: string | null;
    /** What the item is called on the card: a lot (the default) or, for a private sale, a work. */
    itemLabel?: "Lot" | "Work";
  };
  /** After a buyer default: told to the buyer, the seller or the next bidder. */
  "buyer-default-notice": {
    userName?: string | null;
    audience: "buyer" | "seller" | "underbidder";
    lotTitle: string;
    amount: string;
    outcome: "returned_to_inventory" | "offered_to_underbidder";
    buyerRestricted: boolean;
    /** Where the person goes next: their purchases, the lot or the consignment list. */
    actionUrl: string;
    actionLabel: string;
    supportContactEmail: string;
  };
  "payment-manual-review-buyer-notice": {
    userName?: string | null;
    lotTitle: string;
    lotReference?: string | null;
    supportContactEmail: string;
  };
  "payment-manual-review-admin-notice": {
    paymentId: string;
    lotTitle: string;
    lotReference?: string | null;
    sellerEntityName: string;
    amount: string;
    currency: string;
    adminReviewUrl: string;
  };
  "payment-unapplied-money-admin-notice": {
    recipientFirstName?: string | null;
    /** One sentence saying what happened, in plain words. */
    situation: string;
    /** Formatted for display ("£1,250.00"). */
    amount: string;
    /** The Stripe payment or balance reference finance looks the money up by. */
    reference: string;
    lotTitle?: string | null;
    /** Where to look at it; absent when the place to look has no address configured. */
    reviewUrl?: string;
  };
  "dispute-opened-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    amount: string;
    currency: string;
    reason?: string | null;
    supportContactEmail: string;
  };
  "dispute-closed-notice": {
    recipientFirstName?: string | null;
    entityName: string;
    amount: string;
    currency: string;
    outcome: string;
    supportContactEmail: string;
  };
};

export const paymentTemplates = {
  names,
  vars: {} as PaymentTemplateVars,
  recipientResolution: {
    "payment-receipt": "live",
    "payment-invoice": "live",
    "bid-invoice-issued": "live",
    "payment-refund-notice": "live",
    "payment-manual-review-buyer-notice": "live",
    "payment-failed-notice": "live",
    "payment-reminder": "live",
    "buyer-default-notice": "live",
    "payment-manual-review-admin-notice": "live",
    "payment-unapplied-money-admin-notice": "live",
    "dispute-opened-notice": "live",
    "dispute-closed-notice": "live",
  },
} satisfies TemplateDomainSlice<PaymentTemplateName, PaymentTemplateVars>;

export type { PaymentTemplateName, PaymentTemplateVars };
