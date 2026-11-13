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

/** A document LAX may hand a buyer: issued for real, with a stored copy that is not a rehearsal. */
function servable(document: BidInvoiceBooksDocument, mode: TargetMode | null): boolean {
  return (
    document.targetMode === mode &&
    document.targetMode !== "dry_run" &&
    document.record.status === "issued" &&
    document.copy !== null &&
    !document.copy.rehearsal
  );
}

function numberOf(document: BidInvoiceBooksDocument): string {
  return document.record.status === "issued" ? document.record.issued.number : "";
}

/**
 * The buyer's invoice card on a Bid purchase, and LAX's stored copies behind its links. Only the
 * member who pays the invoice sees either (as for LAX's own invoice PDF). The card follows the
 * Books mode the switch aims Bid at now: not aimed, or only rehearsing, and it is LAX's own
 * invoice as before; a Books number and a download are only ever shown once Books issued the
 * invoice for real and LAX holds its copy. The buyer downloads that copy, never Books' own link.
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
    const creditNotes: PurchaseCreditNote[] = issued
      ? (held?.creditNotes ?? [])
          .filter((note) => servable(note, mode))
          .map((note) => ({
            documentId: note.documentId,
            number: numberOf(note),
            amountPence: note.grossPence,
          }))
      : [];
    return ok({
      state: standing.kind,
      invoiceNumber: standing.kind === "issued" ? standing.number : null,
      issuedAt: issued ? document.updatedAt.toISOString() : null,
      invoiceDocumentId: issued ? document.documentId : null,
      cancelledAt:
        standing.kind === "cancelled" ? new Date(standing.cancelledAtMs).toISOString() : null,
      totalPence: invoice.totalPence,
      creditNotes,
    });
  }

  /** LAX's stored copy of the invoice or one of its credit notes, as a PDF. */
  async document(
    actor: OrganisationMemberActor,
    lotId: string,
    documentId: string,
  ): BuyingResult<PurchaseInvoicePdf> {
    const found = await findPayersInvoice(this.deps, actor, lotId);
    if (found.isErr()) return err(found.error);
    const { invoice } = found.value;
    if (invoice.voidedAt !== null) return err(buyingError("invoice_not_ready"));
    const mode = await this.booksMode();
    const books = await this.deps.books.read(invoice.id);
    if (!books.ok || !books.value) return err(buyingError("invoice_not_ready"));
    const kinds = [
      ...books.value.invoices.map((d) => ({ d, prefix: "invoice" })),
      ...books.value.creditNotes.map((d) => ({ d, prefix: "credit-note" })),
    ];
    const match = kinds.find(({ d }) => d.documentId === documentId && servable(d, mode));
    if (!match?.d.copy) return err(buyingError("invoice_not_ready"));
    const pdf = await this.deps.storage.getObjectBytes(match.d.copy.storageKey, MAX_COPY_BYTES);
    if (!pdf || pdf.length === 0) return err(buyingError("invoice_not_ready"));
    const safe = numberOf(match.d).replace(/[^A-Za-z0-9-]+/g, "-") || "document";
    return ok({ pdf, filename: `${match.prefix}-${safe}.pdf` });
  }

  /** The mode the switch aims Bid at in Books now, or null (not aimed, or unreadable). */
  private async booksMode(): Promise<TargetMode | null> {
    const config = await this.deps.settings.read();
    return config.ok ? booksTargetMode(config.value.bid) : null;
  }
}
