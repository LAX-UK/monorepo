import { accountPurchaseScope } from "@auction/domain";
import type { BidInvoiceDocument } from "@auction/exports/documents";
import type { IBidInvoiceReader, ILegalEntityRepository } from "@auction/persistence/interfaces";
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
};

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
      status: entry.row.payment?.status === "captured" ? "paid" : "awaiting_payment",
    });
    return ok({ pdf, filename: invoiceFilename(invoice.number, lotId) });
  }
}

/** A name that is safe in a header: letters, digits and dashes only. */
export function invoiceFilename(number: string | null, lotId: string): string {
  const safe = (number ?? `lot-${lotId.slice(0, 8)}`).replace(/[^A-Za-z0-9-]+/g, "-");
  return `invoice-${safe}.pdf`;
}
