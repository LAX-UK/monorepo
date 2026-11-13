import { type TargetMode, parseLaxReference } from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import { accountingDocument, accountingDocumentCopy } from "@auction/db/schema";
import { and, asc, desc, eq, inArray, isNull, notExists, sql } from "drizzle-orm";
import type {
  AccountingClock,
  AccountingDocumentCopy,
  IAccountingDocumentCopies,
  InvoiceEmailDue,
  StoredAccountingDocument,
  UncopiedDocuments,
} from "../../interfaces/accounting.js";
import { rowToStored } from "../../lib/accounting-document-row.js";

const d = accountingDocument;
const c = accountingDocumentCopy;

/** Only Bid invoices get a stored copy and an email in this phase. */
const BID_INVOICE = and(eq(d.product, "bid"), eq(d.kind, "invoice"), eq(d.targetProvider, "books"));

export class DrizzleAccountingDocumentCopies implements IAccountingDocumentCopies {
  constructor(
    private readonly db: Database,
    private readonly clock: AccountingClock,
  ) {}

  async listUncopied(modes: readonly TargetMode[], limit: number): Promise<UncopiedDocuments> {
    if (modes.length === 0) return { documents: [], unreadable: [] };
    const rows = await this.db
      .select()
      .from(d)
      .where(
        and(
          BID_INVOICE,
          eq(d.state, "issued"),
          inArray(d.targetMode, [...modes]),
          notExists(this.db.select({ one: sql`1` }).from(c).where(eq(c.documentId, d.id))),
        ),
      )
      // Newest first: a copy that cannot be fetched (it is retried every tick, and the delayed
      // alert names it) never holds up the invoices issued after it.
      .orderBy(desc(d.updatedAt), desc(d.id))
      .limit(limit);
    const nowMs = this.clock.now().getTime();
    const documents: StoredAccountingDocument[] = [];
    const unreadable: string[] = [];
    for (const row of rows) {
      const stored = rowToStored(row, nowMs);
      if (stored.ok) documents.push(stored.value);
      else unreadable.push(row.id);
    }
    return { documents, unreadable };
  }

  async record(copy: AccountingDocumentCopy): Promise<boolean> {
    const inserted = await this.db
      .insert(c)
      .values({
        documentId: copy.documentId,
        storageKey: copy.storageKey,
        byteSize: copy.byteSize,
        sha256: copy.sha256,
        rehearsal: copy.rehearsal,
        storedAt: copy.storedAt,
      })
      .onConflictDoNothing({ target: c.documentId })
      .returning({ documentId: c.documentId });
    return inserted.length > 0;
  }

  async listEmailDue(limit: number): Promise<InvoiceEmailDue[]> {
    const rows = await this.db
      .select({
        documentId: c.documentId,
        storageKey: c.storageKey,
        reference: d.laxReference,
        number: d.providerNumber,
      })
      .from(c)
      .innerJoin(d, eq(d.id, c.documentId))
      .where(
        and(
          BID_INVOICE,
          eq(d.state, "issued"),
          // A rehearsal is never emailed (the table refuses it too).
          eq(c.rehearsal, false),
          inArray(d.targetMode, ["test_org", "live"]),
          isNull(c.emailQueuedAt),
        ),
      )
      .orderBy(asc(c.storedAt), asc(c.documentId))
      .limit(limit);
    const due: InvoiceEmailDue[] = [];
    for (const row of rows) {
      const parsed = parseLaxReference(row.reference);
      if (!parsed.ok || row.number === null) continue;
      if (parsed.value.product !== "bid" || parsed.value.kind !== "invoice") continue;
      due.push({
        documentId: row.documentId,
        invoiceId: parsed.value.sourceId,
        number: row.number,
        storageKey: row.storageKey,
      });
    }
    return due;
  }

  async markEmailQueued(documentId: string, outboxId: string, at: Date): Promise<boolean> {
    const updated = await this.db
      .update(c)
      .set({ emailQueuedAt: at, emailOutboxId: outboxId })
      .where(and(eq(c.documentId, documentId), isNull(c.emailQueuedAt), eq(c.rehearsal, false)))
      .returning({ documentId: c.documentId });
    return updated.length > 0;
  }
}
