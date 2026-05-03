import type { ReactNode } from "react";

export type FaqItem = {
  /** Stable id used for accordion `value`, anchor links, and JSON-LD `@id`. */
  id: string;
  title: string;
  /** Plain text — always available so JSON-LD/FAQ rich results work. */
  body: string;
  /**
   * Optional richer body for rendering. When omitted, consumers should fall
   * back to `body`.
   */
  bodyNode?: ReactNode;
};

/** Mockup-aligned set of FAQ entries (8). */
export const faqItems: FaqItem[] = [
  {
    id: "bidding",
    title: "Bidding",
    body: "Register for a free account before placing bids. Hammer prices are subject to buyer's premium, taxes, and shipping shown on your invoice.",
  },
  {
    id: "registration",
    title: "How do I register?",
    body: "Create an account, verify your email and phone, and add a payment method. Some sales require an additional ID check.",
  },
  {
    id: "buyers-premium",
    title: "Buyer's premium",
    body: "A 25% premium is added to the hammer price up to £500,000, then 20% above that. Premium tiers and VAT are itemised on your invoice.",
  },
  {
    id: "telephone-bidding",
    title: "Telephone bidding",
    body: "Available for lots above £2,000 by request at least 24 hours before the sale. A specialist will call you on the line you nominate.",
  },
  {
    id: "shipping",
    title: "Shipping",
    body: "We coordinate insured packing and export paperwork worldwide. See the Shipping page for tiers, lead times, and white-glove options.",
  },
  {
    id: "accounts",
    title: "Accounts",
    body: "Update profile, addresses, and notification preferences in your dashboard. Contact concierge@laxauction.house for any access issues.",
  },
  {
    id: "payment",
    title: "Payment",
    body: "Settle in GBP, USD, EUR, or HKD by bank transfer or card within seven days of the sale. Larger lots can be paid by escrow on request.",
  },
  {
    id: "after-i-win",
    title: "After I win",
    body: "You'll receive an invoice within minutes. Once cleared, our registrar coordinates collection or shipping with you and emails the export documents.",
  },
];

export type { ReactNode };
