import { accountPurchaseScope } from "@auction/domain";
import { type BidInvoiceDocument, InvoiceTotalMismatchError } from "@auction/exports/documents";
import type {
  IBidInvoiceReader,
  ILegalEntityRepository,
  IPayoutRepository,
} from "@auction/persistence/interfaces";
import { err, ok } from "neverthrow";
import type {
  BuyingResult,
  IPurchaseInvoicePdfService,
  PurchaseInvoicePdf,
} from "../interfaces/organisation-buying-service.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import type { PurchaseCandidateReader } from "./purchase-candidate.reader.js";
import { buyingError, entityActorOf, memberIsPayer } from "./purchase-view.js";

export type PurchaseInvoicePdfDeps = {
  candidates: Pick<PurchaseCandidateReader, "read">;
  invoices: Pick<IBidInvoiceReader, "findByPaymentIds">;
  accounts: Pick<ILegalEntityRepository, "findById">;
  /** Renders the document; it refuses lines that do not add up to the invoice total. */
  render: (document: BidInvoiceDocument) => Promise<Buffer>;
  /** What has been refunded for a payment so far, from the refund records, in whole pence. */
  refunds: Pick<IPayoutRepository, "sumRefundLineCentsForPayment">;
  /** Tells finance when a stored invoice cannot be shown (an alert, not a page error). */
  metrics: { record(event: string): void };
};

/** The money-path event finance's alert watches (see the monitoring runbook). */
export const INVOICE_PDF_TOTAL_MISMATCH_EVENT = "invoice_pdf_total_mismatch";

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
    const scope = accountPurchaseScope(entityActorOf(actor));
    if (!scope || !memberIsPayer(actor)) return err(buyingError("insufficient_entity_role"));

    const {
      entries: [entry],
    } = await this.deps.candidates.read(actor, scope === "own", [lotId]);
    const paymentId = entry?.row?.payment?.id;
    if (!entry?.row || !entry.view || entry.view.paymentRole !== "payer" || !paymentId) {
      return err(buyingError("invoice_not_ready"));
    }
    const invoice = (await this.deps.invoices.findByPaymentIds([paymentId])).get(paymentId);
    if (!invoice || invoice.voidedAt !== null) return err(buyingError("invoice_not_ready"));
    const account = await this.deps.accounts.findById(actor.legalEntityId);
    if (!account) return err(buyingError("invoice_not_ready"));

    const status = entry.row.payment?.status;
    // A part refund leaves the payment captured, so what was given back comes from the records.
    const refundedPence =
      status === "captured" || status === "refunded"
        ? await this.deps.refunds.sumRefundLineCentsForPayment(paymentId)
        : 0;
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
        refundedPence,
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
