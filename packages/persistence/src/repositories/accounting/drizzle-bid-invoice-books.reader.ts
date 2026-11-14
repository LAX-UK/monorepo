import { type Result, type TargetMode, laxReference, ok, refuse } from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import {
  accountingDocument,
  accountingDocumentCopy,
  accountingDocumentEvent,
  bidInvoice,
} from "@auction/db/schema";
import { and, asc, eq, ne, sql } from "drizzle-orm";
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
const e = accountingDocumentEvent;

/**
 * One Bid invoice and what Books holds for it: its invoice document per target mode and LAX's
 * stored copy of each, with when it was issued (from the event log, which is append-only).
 * Read-only (the Bid API's buyer card).
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

    // When it was issued is the transition's own time in the append-only event log, never the
    // row's `updated_at`, which a later write (a repair, a requeue tool) would move.
    const issuedAt = sql<Date | null>`(
      select min(${e.occurredAt}) from ${e}
       where ${e.documentId} = ${d.id} and ${e.toState} = 'issued'
    )`.mapWith((value: string | Date | null) => (value === null ? null : new Date(value)));
    const invoices = await this.db
      .select({ document: d, copyKey: c.storageKey, copyRehearsal: c.rehearsal, issuedAt })
      .from(d)
      .leftJoin(c, eq(c.documentId, d.id))
      .where(
        and(
          eq(d.product, "bid"),
          eq(d.targetProvider, "books"),
          eq(d.kind, "invoice"),
          eq(d.laxReference, reference.value),
        ),
      )
      .orderBy(asc(d.createdAt), asc(d.id));

    const nowMs = this.clock.now().getTime();
    const toDocument = (row: {
      document: AccountingDocumentRow;
      copyKey: string | null;
      copyRehearsal: boolean | null;
      issuedAt: Date | null;
    }): Result<BidInvoiceBooksDocument | null, StoredDocumentCode> => {
      const stored = rowToStored(row.document, nowMs);
      if (!stored.ok) return stored;
      const mode = stored.value.target?.mode;
      if (mode === undefined) return ok(null);
      return ok({
        documentId: stored.value.id,
        reference: stored.value.reference,
        targetMode: mode as TargetMode,
        record: stored.value.record,
        grossPence: stored.value.totals.grossPence,
        issuedAt: stored.value.record.status === "issued" ? row.issuedAt : null,
        copy:
          row.copyKey === null
            ? null
            : { storageKey: row.copyKey, rehearsal: row.copyRehearsal === true },
      });
    };
    // Its credit notes (refunds, a buyer default's), in the order they were made.
    const credits = await this.db
      .select({ document: d, copyKey: c.storageKey, copyRehearsal: c.rehearsal, issuedAt })
      .from(d)
      .leftJoin(c, eq(c.documentId, d.id))
      .where(
        and(
          eq(d.product, "bid"),
          eq(d.targetProvider, "books"),
          eq(d.kind, "credit_note"),
          sql`${d.payload} ->> 'invoiceReference' = ${reference.value}`,
          ne(d.state, "cancelled"),
        ),
      )
      .orderBy(asc(d.createdAt), asc(d.id));
    const collect = (rows: typeof invoices) => {
      const out: BidInvoiceBooksDocument[] = [];
      for (const row of rows) {
        const one = toDocument(row);
        if (!one.ok) return one;
        if (one.value) out.push(one.value);
      }
      return ok(out);
    };
    const invoiceDocuments = collect(invoices);
    if (!invoiceDocuments.ok) return invoiceDocuments;
    const creditNotes = collect(credits);
    if (!creditNotes.ok) return creditNotes;
    return ok({
      invoice,
      invoices: invoiceDocuments.value,
      creditNotes: creditNotes.value,
      paidWith: await this.paidWith(invoice.id),
    });
  }

  /** How the invoice's paid payment was made; null when that is not known for certain. */
  private async paidWith(invoiceId: string): Promise<"card" | "bank_transfer" | null> {
    const rows = await this.db.execute<{ rail: string | null }>(sql`
      select case
               when p.payment_group_id is not null then (
                 select g.checkout_rail from payment_group g where g.id = p.payment_group_id)
               when (select count(distinct s.rail) from payment_checkout_session s
                      where s.payment_id = p.id and s.rail is not null) = 1 then (
                 select max(s.rail) from payment_checkout_session s
                  where s.payment_id = p.id and s.rail is not null)
             end as rail
        from payment p
       where p.invoice_id = ${invoiceId} and p.status in ('captured', 'refunded')
       order by p.created_at desc
       limit 1`);
    const rail = rows.rows[0]?.rail ?? null;
    if (rail === "card") return "card";
    if (rail === "gb_bank_transfer" || rail === "bank") return "bank_transfer";
    return null;
  }
}
