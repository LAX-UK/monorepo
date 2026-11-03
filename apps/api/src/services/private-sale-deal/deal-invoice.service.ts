import { type DealInvoiceIssuer, computeDealMoney } from "@auction/domain";
import type { IPrivateSaleDealFinanceStore } from "@auction/persistence/interfaces";
import type { DealTransitionOutcome, DealTransitionService } from "./deal-transition.service.js";

export type DealInvoiceDeps = {
  transitions: Pick<DealTransitionService, "transition">;
  finance: Pick<IPrivateSaleDealFinanceStore, "recordInvoiceReference">;
  /**
   * The finance system that issues invoices. `null` until one is connected: the deal is then
   * invoiced with no reference, and one can be attached later.
   */
  issuer: DealInvoiceIssuer | null;
};

/**
 * Moves a cleared deal to invoiced and records the reference of the invoice the finance system
 * raised for it, when there is one. This system never numbers or renders an invoice itself.
 */
export class DealInvoiceService {
  constructor(private readonly deps: DealInvoiceDeps) {}

  async issue(input: { dealId: string; actorUserId: string }): Promise<DealTransitionOutcome> {
    const outcome = await this.deps.transitions.transition(input.dealId, "issue_invoice", {
      actorUserId: input.actorUserId,
    });
    if (outcome.kind !== "ok" || !this.deps.issuer) return outcome;

    const { deal } = outcome;
    if (
      !deal.buyer ||
      deal.priceMinor === null ||
      deal.vatTreatment === null ||
      deal.paymentDueAt === null
    ) {
      return outcome;
    }
    try {
      const issued = await this.deps.issuer.issue({
        dealId: deal.id,
        reference: deal.reference,
        buyerLegalEntityId: deal.buyer.legalEntityId,
        sellerLegalEntityId: deal.seller.legalEntityId,
        money: computeDealMoney({
          priceMinor: deal.priceMinor,
          buyerFeeBps: deal.buyerFeeBps,
          sellerCommissionBps: deal.sellerCommissionBps,
          costsMinor: deal.costsMinor,
        }),
        vatTreatment: deal.vatTreatment,
        paymentDueAt: deal.paymentDueAt,
      });
      if (!issued) return outcome;
      await this.deps.finance.recordInvoiceReference(deal.id, issued.externalReference);
      return { kind: "ok", deal: { ...deal, invoiceReference: issued.externalReference } };
    } catch (e) {
      // The deal is invoiced; the reference can be attached when the finance system recovers.
      console.error(
        JSON.stringify({
          msg: "private_sale_invoice_reference_failed",
          dealId: deal.id,
          error: e instanceof Error ? e.message : String(e),
        }),
      );
      return outcome;
    }
  }

  /** Attaches the reference of an invoice raised outside this system. */
  async attachReference(input: { dealId: string; externalReference: string }): Promise<void> {
    const reference = input.externalReference.trim();
    if (reference === "") throw new RangeError("an invoice reference cannot be empty");
    await this.deps.finance.recordInvoiceReference(input.dealId, reference);
  }
}
