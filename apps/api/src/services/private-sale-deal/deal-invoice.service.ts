import type { Database } from "@auction/db";
import {
  type DealBlocker,
  type DealInvoiceIssuer,
  type DealInvoiceRequest,
  computeDealMoney,
} from "@auction/domain";
import type {
  IPrivateSaleDealFinanceStore,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import type { PrivateSaleDealDetail } from "@auction/types";
import type {
  DealTransitionOutcome,
  DealTransitionScope,
  DealTransitionService,
} from "./deal-transition.service.js";

/** The move to invoiced and the reference it records, bound to one transaction. */
export type DealInvoiceScope = DealTransitionScope & {
  finance: Pick<IPrivateSaleDealFinanceStore, "recordInvoiceReference">;
};

export type DealInvoiceDeps = {
  transitions: Pick<DealTransitionService, "transition">;
  transactionRunner: ITransactionRunner;
  scopeForTx: (tx: Database) => DealInvoiceScope;
  /**
   * The finance system that issues invoices. `null` until one is connected, and then no deal can
   * be invoiced: a deal never reaches invoiced without a system that raises its invoice.
   */
  issuer: DealInvoiceIssuer | null;
};

/** The finance system gave no reference: the move to invoiced is undone. */
class InvoiceNotIssued extends Error {}

const NOT_ISSUED: DealTransitionOutcome = {
  kind: "blocked",
  blockers: [{ code: "invoice_not_issued" }],
};

/**
 * Moves a cleared deal to invoiced together with the reference of the invoice the finance system
 * raised for it, in one transaction: if the finance system returns no reference or fails, the move
 * is undone and the deal stays where it was. This system never numbers or renders an invoice
 * itself. The issuer is asked inside the transaction, so it must treat a repeat for the same deal
 * as the same invoice (a move undone after it answered is tried again).
 */
export class DealInvoiceService {
  constructor(private readonly deps: DealInvoiceDeps) {}

  /** What keeps every deal from being invoiced, whatever its own state. */
  blockers(): DealBlocker[] {
    return this.deps.issuer ? [] : [{ code: "invoice_issuer_not_configured" }];
  }

  async issue(input: {
    dealId: string;
    actorUserId: string;
    expectedVersion?: number;
  }): Promise<DealTransitionOutcome> {
    const { issuer } = this.deps;
    if (!issuer) return { kind: "blocked", blockers: this.blockers() };

    try {
      return await this.deps.transactionRunner.runInTransaction(async (tx) => {
        const scope = this.deps.scopeForTx(tx);
        const outcome = await this.deps.transitions.transition(
          input.dealId,
          "issue_invoice",
          {
            actorUserId: input.actorUserId,
            ...(input.expectedVersion !== undefined
              ? { expectedVersion: input.expectedVersion }
              : {}),
          },
          scope,
        );
        if (outcome.kind !== "ok") return outcome;
        const reference = await raise(issuer, outcome.deal);
        await scope.finance.recordInvoiceReference(outcome.deal.id, reference);
        return { kind: "ok", deal: { ...outcome.deal, invoiceReference: reference } };
      });
    } catch (e) {
      if (!(e instanceof InvoiceNotIssued)) throw e;
      console.error(
        JSON.stringify({
          msg: "private_sale_invoice_not_issued",
          dealId: input.dealId,
          error: e.message,
        }),
      );
      return NOT_ISSUED;
    }
  }
}

/** The reference the finance system returns for the deal's invoice; throws `InvoiceNotIssued` without one. */
async function raise(issuer: DealInvoiceIssuer, deal: PrivateSaleDealDetail): Promise<string> {
  const request = invoiceRequest(deal);
  if (!request) throw new InvoiceNotIssued("deal_missing_invoice_terms");
  let issued: Awaited<ReturnType<DealInvoiceIssuer["issue"]>>;
  try {
    issued = await issuer.issue(request);
  } catch (e) {
    throw new InvoiceNotIssued(e instanceof Error ? e.message : String(e));
  }
  const reference = issued?.externalReference.trim() ?? "";
  if (reference === "") throw new InvoiceNotIssued("no_reference_returned");
  return reference;
}

function invoiceRequest(deal: PrivateSaleDealDetail): DealInvoiceRequest | null {
  if (
    !deal.buyer ||
    deal.priceMinor === null ||
    deal.vatTreatment === null ||
    deal.paymentDueAt === null
  ) {
    return null;
  }
  return {
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
  };
}
