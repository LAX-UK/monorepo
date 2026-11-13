import { type Result, type TargetMode, laxReference, ok, refuse } from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import { accountingDocument, accountingDocumentCopy, bidInvoice } from "@auction/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import type {
  AccountingClock,
  BidInvoiceBooksDocument,
  BidInvoiceBooksState,
  IBidInvoiceBooksReader,
  StoredDocumentCode,
} from "../../interfaces/accounting.js";
import { type AccountingDocumentRow, rowToStored } from "../../lib/accounting-document-row.js";

const d = accountingDocument;
const c = accountingDocumentCopy;

/**
 * One Bid invoice and what Books holds for it: its invoice document per target mode, the credit
 * notes made against it, and LAX's stored copy of each. Read-only (the Bid API's buyer card).
 */
export class DrizzleBidInvoiceBooksReader implements IBidInvoiceBooksReader {
  constructor(
    private readonly db: Database,
    private readonly clock: AccountingClock,
  ) {}

  async read(invoiceId: string): Promise<Result<BidInvoiceBooksState | null, StoredDocumentCode>> {
    const [invoice] = await this.db
      .select({
        id: bidInvoice.id,
        raisedAt: bidInvoice.raisedAt,
        voidedAt: bidInvoice.voidedAt,
        totalPence: bidInvoice.totalPence,
      })
      .from(bidInvoice)
      .where(eq(bidInvoice.id, invoiceId));
    if (!invoice) return ok(null);
    const reference = laxReference("bid", "invoice", invoice.id.toLowerCase());
    if (!reference.ok) return refuse("bad_stored_document", reference.refusal.message);

    const columns = { document: d, copyKey: c.storageKey, copyRehearsal: c.rehearsal };
    const BOOKS = and(eq(d.product, "bid"), eq(d.targetProvider, "books"));
    const [invoices, credits] = await Promise.all([
      this.db
        .select(columns)
        .from(d)
        .leftJoin(c, eq(c.documentId, d.id))
        .where(and(BOOKS, eq(d.kind, "invoice"), eq(d.laxReference, reference.value)))
        .orderBy(asc(d.createdAt), asc(d.id)),
      this.db
        .select(columns)
        .from(d)
        .leftJoin(c, eq(c.documentId, d.id))
        .where(
          and(
            BOOKS,
            eq(d.kind, "credit_note"),
            sql`${d.payload} ->> 'invoiceReference' = ${reference.value}`,
          ),
        )
        .orderBy(asc(d.createdAt), asc(d.id)),
    ]);

    const nowMs = this.clock.now().getTime();
    const toDocument = (row: {
      document: AccountingDocumentRow;
      copyKey: string | null;
      copyRehearsal: boolean | null;
    }): Result<BidInvoiceBooksDocument | null, StoredDocumentCode> => {
      const stored = rowToStored(row.document, nowMs);
      if (!stored.ok) return stored;
      const mode = stored.value.target?.mode;
      if (mode === undefined) return ok(null);
      return ok({
        documentId: stored.value.id,
        targetMode: mode as TargetMode,
        record: stored.value.record,
        grossPence: stored.value.totals.grossPence,
        updatedAt: stored.value.updatedAt,
        copy:
          row.copyKey === null
            ? null
            : { storageKey: row.copyKey, rehearsal: row.copyRehearsal === true },
      });
    };
    const all = (rows: typeof invoices) => {
      const out: BidInvoiceBooksDocument[] = [];
      for (const row of rows) {
        const one = toDocument(row);
        if (!one.ok) return one;
        if (one.value) out.push(one.value);
      }
      return ok(out);
    };
    const invoiceDocuments = all(invoices);
    if (!invoiceDocuments.ok) return invoiceDocuments;
    const creditNotes = all(credits);
    if (!creditNotes.ok) return creditNotes;
    return ok({
      invoice,
      invoices: invoiceDocuments.value,
      creditNotes: creditNotes.value,
    });
  }
}
