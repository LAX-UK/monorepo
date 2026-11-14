import { type TargetMode, parseLaxReference } from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import { accountingDocument, accountingDocumentCopy } from "@auction/db/schema";
import { and, asc, desc, eq, inArray, isNull, notExists, sql } from "drizzle-orm";
import type {
  AccountingClock,
  AccountingDocumentCopy,
  IAccountingDocumentCopies,
  InvoiceEmailDue,
  InvoiceEmailDueList,
  InvoiceEmailSkipReason,
  StoredAccountingDocument,
  UncopiedDocuments,
} from "../../interfaces/accounting.js";
import { rowToStored } from "../../lib/accounting-document-row.js";

const d = accountingDocument;
const c = accountingDocumentCopy;

/** Bid and Shop invoices get a stored copy and an email; lax.art's and other kinds do not yet. */
const COPIED_PRODUCTS = ["bid", "shop"] as const;
const INVOICE = and(
  inArray(d.product, [...COPIED_PRODUCTS]),
  eq(d.kind, "invoice"),
  eq(d.targetProvider, "books"),
);

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
          INVOICE,
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

  async listEmailDue(limit: number): Promise<InvoiceEmailDueList> {
    const rows = await this.db
      .select({
        documentId: c.documentId,
        storageKey: c.storageKey,
        reference: d.laxReference,
        product: d.product,
        number: d.providerNumber,
        grossPence: d.grossPence,
      })
      .from(c)
      .innerJoin(d, eq(d.id, c.documentId))
      .where(
        and(
          INVOICE,
          eq(d.state, "issued"),
          // A rehearsal is never emailed, and neither is a test organisation's invoice: only an
          // invoice Books issued live reaches a buyer.
          eq(c.rehearsal, false),
          eq(d.targetMode, "live"),
          isNull(c.emailQueuedAt),
          isNull(c.emailSkippedAt),
        ),
      )
      .orderBy(asc(c.storedAt), asc(c.documentId))
      .limit(limit);
    const due: InvoiceEmailDue[] = [];
    const unreadable: string[] = [];
    for (const row of rows) {
      const parsed = parseLaxReference(row.reference);
      const product = parsed.ok ? parsed.value.product : null;
      if (
        !parsed.ok ||
        row.number === null ||
        (product !== "bid" && product !== "shop") ||
        product !== row.product ||
        parsed.value.kind !== "invoice"
      ) {
        // Named, so the caller settles it and it never holds a place at the head of the list.
        unreadable.push(row.documentId);
        continue;
      }
      due.push({
        documentId: row.documentId,
        product,
        invoiceId: parsed.value.sourceId,
        number: row.number,
        grossPence: row.grossPence,
        storageKey: row.storageKey,
      });
    }
    return { due, unreadable };
  }

  async markEmailQueued(documentId: string, outboxId: string, at: Date): Promise<boolean> {
    const updated = await this.db
      .update(c)
      .set({ emailQueuedAt: at, emailOutboxId: outboxId })
      .where(
        and(
          eq(c.documentId, documentId),
          isNull(c.emailQueuedAt),
          isNull(c.emailSkippedAt),
          eq(c.rehearsal, false),
        ),
      )
      .returning({ documentId: c.documentId });
    return updated.length > 0;
  }

  async markEmailSkipped(
    documentId: string,
    reason: InvoiceEmailSkipReason,
    at: Date,
  ): Promise<boolean> {
    const updated = await this.db
      .update(c)
      .set({ emailSkippedAt: at, emailSkipReason: reason })
      .where(and(eq(c.documentId, documentId), isNull(c.emailQueuedAt), isNull(c.emailSkippedAt)))
      .returning({ documentId: c.documentId });
    return updated.length > 0;
  }
}
