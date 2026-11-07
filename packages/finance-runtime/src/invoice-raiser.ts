import { invoiceDueAt } from "@auction/domain";
import type {
  BidInvoiceRecord,
  CreatePaymentRow,
  IBidInvoiceRaiseRepository,
  IBidInvoiceReader,
  ISaleRepository,
  RaisedInvoice,
} from "@auction/persistence/interfaces";
import type { InvoiceLine, Lot } from "@auction/types";
import { buildInvoiceLines, sumInvoiceLines } from "@auction/validators";

/** The invoice cannot be priced now (the sale could not be read), so nothing is raised. */
export class InvoicePricingUnavailableError extends Error {
  constructor(options?: { cause?: unknown }) {
    super("The invoice cannot be priced because the sale could not be read", options);
    this.name = "InvoicePricingUnavailableError";
  }
}

/** The lines, the total and the payment do not agree, so nothing is stored. */
export class InvoiceInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceInvariantError";
  }
}

/** What an invoice will charge, fixed when it is raised. */
export type PricedInvoice = {
  lines: InvoiceLine[];
  totalPence: number;
  policyId: string | null;
  /** The lot's live invoice, when one exists: it is used as it is and never priced again. */
  existing: BidInvoiceRecord | null;
};

export type InvoiceRaiserDeps = {
  invoices: IBidInvoiceReader & IBidInvoiceRaiseRepository;
  sales: Pick<ISaleRepository, "findById"> | null;
  now?: () => Date;
};

function assertLinesAddUp(lines: readonly InvoiceLine[], totalPence: number): void {
  if (lines.length === 0) throw new InvoiceInvariantError("An invoice needs at least one line");
  for (const line of lines) {
    if (!Number.isSafeInteger(line.amountPence) || line.amountPence < 0) {
      throw new InvoiceInvariantError(
        `Invoice line "${line.label}" is not a whole number of pence`,
      );
    }
  }
  if (!Number.isSafeInteger(totalPence) || totalPence <= 0) {
    throw new InvoiceInvariantError("An invoice total must be a positive whole number of pence");
  }
  const sum = sumInvoiceLines(lines);
  if (sum !== totalPence) {
    throw new InvoiceInvariantError(
      `Invoice lines add up to ${sum} pence but the total is ${totalPence} pence`,
    );
  }
}

/**
 * The one way an invoice is raised, for a won lot, from lot end (the worker and the API backfill)
 * and from checkout. It prices the invoice once, stores it with its lines and the payment row in
 * one transaction, and afterwards every surface reads those stored figures and the stored due date.
 *
 * A payment row raised for a lot and account that already has a live invoice (a retry after the
 * last payment expired) joins that invoice: it is neither priced again nor given a new due date.
 */
export class InvoiceRaiser {
  private readonly now: () => Date;

  constructor(private readonly deps: InvoiceRaiserDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /** What the lot's invoice charges: the stored lines of its live invoice, else a fresh pricing. */
  async price(lot: Lot): Promise<PricedInvoice> {
    if (!lot.buyerLegalEntityId) {
      throw new InvoiceInvariantError("A lot needs its buyer account before it can be invoiced");
    }
    const existing = await this.deps.invoices.findLiveByLotAndBuyerAccount(
      lot.id,
      lot.buyerLegalEntityId,
    );
    if (existing) {
      return {
        lines: existing.lines,
        totalPence: existing.totalPence,
        policyId: existing.pricingPolicyId,
        existing,
      };
    }
    try {
      if (lot.saleId && !this.deps.sales) throw new Error("No sale repository to price the lot");
      const sale =
        lot.saleId && this.deps.sales ? await this.deps.sales.findById(lot.saleId) : null;
      return { ...buildInvoiceLines(lot, sale), existing: null };
    } catch (cause) {
      throw new InvoicePricingUnavailableError({ cause });
    }
  }

  /** Stores the priced invoice with its lines and the payment that settles it. */
  async raise(input: {
    lot: Lot;
    priced: PricedInvoice;
    payment: Omit<CreatePaymentRow, "amount" | "invoiceId">;
  }): Promise<RaisedInvoice> {
    const { lot, priced, payment } = input;
    if (!lot.buyerLegalEntityId || !lot.sellerLegalEntityId) {
      throw new InvoiceInvariantError("A lot needs its buyer and seller accounts to be invoiced");
    }
    assertLinesAddUp(priced.lines, priced.totalPence);
    const raisedAt = this.now();
    return this.deps.invoices.raise({
      invoice: {
        lotId: lot.id,
        buyerLegalEntityId: lot.buyerLegalEntityId,
        sellerLegalEntityId: lot.sellerLegalEntityId,
        totalPence: priced.totalPence,
        raisedAt,
        dueAt: invoiceDueAt(raisedAt),
        pricingPolicyId: priced.policyId,
        lines: priced.lines,
      },
      payment,
    });
  }
}
