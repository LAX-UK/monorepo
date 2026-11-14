import { type BidInvoiceDocument, InvoiceTotalMismatchError } from "@auction/exports/documents";
import type {
  IBidInvoiceReader,
  ILegalEntityRepository,
  IPaymentRefundReader,
} from "@auction/persistence/interfaces";
import { err, ok } from "neverthrow";
import type {
  BuyingResult,
  IPurchaseInvoicePdfService,
  PurchaseInvoicePdf,
} from "../interfaces/organisation-buying-service.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import { findPayersInvoice } from "./payer-invoice.js";
import type { PurchaseCandidateReader } from "./purchase-candidate.reader.js";
import { buyingError } from "./purchase-view.js";

export type PurchaseInvoicePdfDeps = {
  candidates: Pick<PurchaseCandidateReader, "read">;
  invoices: Pick<IBidInvoiceReader, "findByPaymentIds">;
  accounts: Pick<ILegalEntityRepository, "findById">;
  /** Renders the document; it refuses lines that do not add up to the invoice total. */
  render: (document: BidInvoiceDocument) => Promise<Buffer>;
  /** What the buyer has been refunded for a payment: Bid's own record, never the seller's payout ledger. */
  refunds: IPaymentRefundReader;
  /** Tells finance when a stored invoice cannot be shown (an alert, not a page error). */
  metrics: { record(event: string): void };
  /** Carries the ids and amounts behind a money-path alert; never personal data. */
  log: { warn(fields: Record<string, unknown>, message: string): void };
};

/** The money-path event finance's alert watches (see the monitoring runbook). */
export const INVOICE_PDF_TOTAL_MISMATCH_EVENT = "invoice_pdf_total_mismatch";
/** Recorded refunds add up to more than the invoice total; the document shows the total at most. */
export const INVOICE_PDF_REFUND_EXCEEDS_TOTAL_EVENT = "invoice_pdf_refund_exceeds_total";
/** A refund was recorded in a currency other than GBP, so the invoice is refused. */
export const INVOICE_PDF_REFUND_CURRENCY_EVENT = "invoice_pdf_refund_currency";
/** The payment is marked refunded but no refund is recorded for it. */
export const INVOICE_PDF_REFUND_MISSING_EVENT = "invoice_pdf_refund_missing";

/**
 * The invoice of a won lot as a PDF, for the member who pays it. The figures are the stored
 * invoice's, never recomputed. Only a payer of the acting account gets it: a member who is only
 * told about the purchase, a lot of another account and a voided invoice are all refused, with
 * the same answer for a lot that does not exist, so the invoice of someone else's lot is not
 * confirmed.
 */
export class PurchaseInvoicePdfService implements IPurchaseInvoicePdfService {
  constructor(private readonly deps: PurchaseInvoicePdfDeps) {}

  async render(actor: OrganisationMemberActor, lotId: string): BuyingResult<PurchaseInvoicePdf> {
    const found = await findPayersInvoice(this.deps, actor, lotId);
    if (found.isErr()) return err(found.error);
    const { invoice, entry } = found.value;
    if (invoice.voidedAt !== null) return err(buyingError("invoice_not_ready"));
    const paymentId = entry.row.payment?.id ?? "";
    const account = await this.deps.accounts.findById(actor.legalEntityId);
    if (!account) return err(buyingError("invoice_not_ready"));

    const status = entry.row.payment?.status;
    const recorded =
      status === "captured" || status === "refunded"
        ? await this.deps.refunds.sumRefundedPence(paymentId)
        : NO_REFUNDS;
    if (recorded.otherCurrencies.length > 0) {
      // Pence of another currency are not pounds: the figure is not shown, and finance is told.
      this.deps.metrics.record(INVOICE_PDF_REFUND_CURRENCY_EVENT);
      this.deps.log.warn(
        {
          event: INVOICE_PDF_REFUND_CURRENCY_EVENT,
          paymentId,
          lotId,
          invoiceId: invoice.id,
          currencies: recorded.otherCurrencies,
        },
        "A refund is recorded in a currency other than GBP; the PDF is refused",
      );
      return err(buyingError("invoice_total_mismatch"));
    }
    const refundedPence = recorded.pence;
    // The document never shows more than the total; finance is told when the records do.
    if (refundedPence > invoice.totalPence) {
      this.deps.metrics.record(INVOICE_PDF_REFUND_EXCEEDS_TOTAL_EVENT);
      this.deps.log.warn(
        {
          event: INVOICE_PDF_REFUND_EXCEEDS_TOTAL_EVENT,
          paymentId,
          lotId,
          invoiceId: invoice.id,
          totalPence: invoice.totalPence,
          refundedPence,
        },
        "Recorded refunds exceed the invoice total; the PDF shows the total",
      );
    }
    if (status === "refunded" && refundedPence === 0) {
      // Refunded before refunds were recorded, and the ledger had nothing to copy.
      this.deps.metrics.record(INVOICE_PDF_REFUND_MISSING_EVENT);
      this.deps.log.warn(
        { event: INVOICE_PDF_REFUND_MISSING_EVENT, paymentId, lotId, invoiceId: invoice.id },
        "The payment is refunded but no refund is recorded; the PDF shows it as refunded",
      );
    }
    try {
      const pdf = await this.deps.render({
        number: invoice.number,
        raisedAt: invoice.raisedAt,
        dueAt: invoice.dueAt,
        billedTo: account.legalName?.trim() || account.displayName,
        lot: {
          title: entry.row.lotTitle,
          lotNumber: entry.row.lotNumber,
          saleTitle: entry.row.saleTitle,
        },
        lines: invoice.lines,
        totalPence: invoice.totalPence,
        status: documentStatusOf(status),
        refundedPence: Math.min(refundedPence, invoice.totalPence),
      });
      return ok({ pdf, filename: invoiceFilename(invoice.number, lotId) });
    } catch (error) {
      if (!(error instanceof InvoiceTotalMismatchError)) throw error;
      // Never shown wrongly: the member is told it is being looked at, and finance is alerted.
      this.deps.metrics.record(INVOICE_PDF_TOTAL_MISMATCH_EVENT);
      return err(buyingError("invoice_total_mismatch"));
    }
  }
}

const NO_REFUNDS = { pence: 0, otherCurrencies: [] as readonly string[] };

/** How the document describes the payment: a refund is never shown as awaiting payment. */
function documentStatusOf(status: string | undefined): BidInvoiceDocument["status"] {
  if (status === "captured") return "paid";
  if (status === "refunded") return "refunded";
  return "awaiting_payment";
}

/** A name that is safe in a header: letters, digits and dashes only. */
export function invoiceFilename(number: string | null, lotId: string): string {
  const safe = (number ?? `lot-${lotId.slice(0, 8)}`).replace(/[^A-Za-z0-9-]+/g, "-");
  return `invoice-${safe}.pdf`;
}
