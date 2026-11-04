import type { PrivateSaleDealMoney } from "@auction/types";

/** What an invoice for a deal is raised from. */
export type DealInvoiceRequest = {
  dealId: string;
  reference: string;
  buyerLegalEntityId: string;
  sellerLegalEntityId: string;
  money: PrivateSaleDealMoney;
  vatTreatment: string;
  paymentDueAt: Date;
};

/** The invoice as the system that issued it knows it. */
export type DealInvoiceReference = { externalReference: string };

/**
 * Raises the invoice for a deal in the finance system that owns invoices. This system never
 * numbers or renders an invoice itself: it records the reference the finance system returns.
 * Until an implementation is configured there is none, and the deal is invoiced without a
 * reference that can be added later.
 */
export interface DealInvoiceIssuer {
  issue(request: DealInvoiceRequest): Promise<DealInvoiceReference | null>;
}
