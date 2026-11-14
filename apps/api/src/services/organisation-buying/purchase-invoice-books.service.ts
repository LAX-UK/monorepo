import { type TargetMode, booksTargetMode, invoiceStanding } from "@auction/accounting-domain";
import type {
  BidInvoiceBooksDocument,
  IAccountingSourceSettingReader,
  IBidInvoiceBooksReader,
} from "@auction/persistence/interfaces";
import type { PurchaseCreditNote, PurchaseInvoiceCard } from "@auction/types";
import { err, ok } from "neverthrow";
import type {
  BuyingResult,
  IPurchaseInvoiceBooksService,
  PurchaseInvoicePdf,
} from "../interfaces/organisation-buying-service.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import { type PayerInvoiceDeps, findPayersInvoice } from "./payer-invoice.js";
import { buyingError } from "./purchase-view.js";

/** A stored copy is one Books PDF; anything larger is not served. */
const MAX_COPY_BYTES = 10 * 1024 * 1024;

export type PurchaseInvoiceBooksDeps = PayerInvoiceDeps & {
  books: IBidInvoiceBooksReader;
  settings: IAccountingSourceSettingReader;
  /** LAX's document storage, where the stored copies are. */
  storage: { getObjectBytes(key: string, maxBytes: number): Promise<Buffer | null> };
  now: () => Date;
};

/**
 * A document LAX may hand a buyer: issued live in the mode Books is aimed at now, with a stored
 * copy that is not a rehearsal. Never a dry run's or the test organisation's.
 */
function servable(document: BidInvoiceBooksDocument, mode: TargetMode | null): boolean {
  return (
    document.targetMode === mode &&
    document.targetMode === "live" &&
    document.record.status === "issued" &&
    document.copy !== null &&
    !document.copy.rehearsal
  );
}

/** A buyer default's credit note: `LAX-BID-CN-dft-<invoice>`. */
function isDefaultCredit(document: BidInvoiceBooksDocument): boolean {
  return /^LAX-BID-CN-dft-/.test(document.reference);
}

function numberOf(document: BidInvoiceBooksDocument): string {
  return document.record.status === "issued" ? document.record.issued.number : "";
}

/**
 * The buyer's invoice card on a Bid purchase, and LAX's stored copies behind its links. Only the
 * member who pays the invoice sees either (as for LAX's own invoice PDF). The card follows the
 * Books mode the switch aims Bid at now: not aimed, only rehearsing, or the test organisation, and
 * it is LAX's own invoice as before; a Books number and a download are only ever shown once Books
 * issued the invoice live and LAX holds its copy. The buyer downloads that copy, never Books' own
 * link. Its credit notes (a refund's, a buyer default's) follow the same rule: listed and served
 * only once issued live with LAX's copy stored, never a rehearsal or the test organisation's.
 */
export class PurchaseInvoiceBooksService implements IPurchaseInvoiceBooksService {
  constructor(private readonly deps: PurchaseInvoiceBooksDeps) {}

  async card(actor: OrganisationMemberActor, lotId: string): BuyingResult<PurchaseInvoiceCard> {
    const found = await findPayersInvoice(this.deps, actor, lotId);
    if (found.isErr()) return err(found.error);
    const { invoice } = found.value;
    const mode = await this.booksMode();
    const books = await this.deps.books.read(invoice.id);
    // Unreadable Books records never block the purchase page: the buyer keeps LAX's own invoice.
    const held = books.ok ? books.value : null;
    const document = held?.invoices.find((d) => d.targetMode === mode) ?? null;
    const standing = invoiceStanding(
      {
        raisedAtMs: invoice.raisedAt.getTime(),
        cancelledAtMs: invoice.voidedAt?.getTime() ?? null,
        booksMode: books.ok ? mode : null,
        document: document
          ? {
              record: document.record,
              copyStored: document.copy !== null && !document.copy.rehearsal,
            }
          : null,
      },
      this.deps.now().getTime(),
    );
    const issued = standing.kind === "issued" && document !== null;
    // Credit notes only beside a Books card (never beside LAX's own invoice), and only servable ones.
    const credits =
      standing.kind === "issued" || standing.kind === "cancelled"
        ? (held?.creditNotes ?? []).filter((d) => servable(d, mode))
        : [];
    const creditNotes: PurchaseCreditNote[] = credits.map((d) => ({
      documentId: d.documentId,
      number: numberOf(d),
      grossPence: d.grossPence,
      issuedAt: d.issuedAt?.toISOString() ?? null,
      kind: isDefaultCredit(d) ? "default" : "refund",
    }));
    const defaulted =
      standing.kind === "cancelled" &&
      (held?.creditNotes ?? []).some((d) => d.targetMode === mode && isDefaultCredit(d));
    return ok({
      state: standing.kind,
      invoiceNumber: standing.kind === "issued" ? standing.number : null,
      // When Books issued it (the event log's time), never when the row last changed.
      issuedAt: issued ? (document.issuedAt?.toISOString() ?? null) : null,
      invoiceDocumentId: issued ? document.documentId : null,
      cancelledAt:
        standing.kind === "cancelled" ? new Date(standing.cancelledAtMs).toISOString() : null,
      totalPence: invoice.totalPence,
      cancelledAfterDefault: defaulted,
      creditNotes,
    });
  }

  /** LAX's stored copy of the invoice, as a PDF. */
  async document(
    actor: OrganisationMemberActor,
    lotId: string,
    documentId: string,
  ): BuyingResult<PurchaseInvoicePdf> {
    const found = await findPayersInvoice(this.deps, actor, lotId);
    if (found.isErr()) return err(found.error);
    const { invoice } = found.value;
    const mode = await this.booksMode();
    const books = await this.deps.books.read(invoice.id);
    if (!books.ok || !books.value) return err(buyingError("invoice_not_ready"));
    // Only this invoice's own documents: an id of anything else is the same "not ready". A
    // cancelled invoice is not served, but its credit notes are (the one that cancels it too).
    const invoiceCopy =
      invoice.voidedAt === null
        ? books.value.invoices.find((d) => d.documentId === documentId && servable(d, mode))
        : undefined;
    const creditCopy = books.value.creditNotes.find(
      (d) => d.documentId === documentId && servable(d, mode),
    );
    const match = invoiceCopy ?? creditCopy;
    if (!match?.copy) return err(buyingError("invoice_not_ready"));
    const pdf = await this.deps.storage.getObjectBytes(match.copy.storageKey, MAX_COPY_BYTES);
    if (!pdf || pdf.length === 0) return err(buyingError("invoice_not_ready"));
    const safe = numberOf(match).replace(/[^A-Za-z0-9-]+/g, "-") || "document";
    return ok({ pdf, filename: `${invoiceCopy ? "invoice" : "credit-note"}-${safe}.pdf` });
  }

  /** The mode the switch aims Bid at in Books now, or null (not aimed, or unreadable). */
  private async booksMode(): Promise<TargetMode | null> {
    const config = await this.deps.settings.read();
    return config.ok ? booksTargetMode(config.value.bid) : null;
  }
}
