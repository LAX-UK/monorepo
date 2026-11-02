import type { BillToContext } from "@auction/types";
import type { TemplateDomainSlice } from "./shared.js";

const names = [
  "payment-receipt",
  "payment-invoice",
  "payment-refund-notice",
  "payment-manual-review-buyer-notice",
  "payment-failed-notice",
  "payment-manual-review-admin-notice",
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
    "payment-refund-notice": "live",
    "payment-manual-review-buyer-notice": "live",
    "payment-failed-notice": "live",
    "payment-manual-review-admin-notice": "live",
    "dispute-opened-notice": "live",
    "dispute-closed-notice": "live",
  },
} satisfies TemplateDomainSlice<PaymentTemplateName, PaymentTemplateVars>;

export type { PaymentTemplateName, PaymentTemplateVars };
