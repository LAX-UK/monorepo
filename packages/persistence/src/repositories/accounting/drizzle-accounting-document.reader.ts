import {
  type CreditNote,
  type DocumentTarget,
  type Product,
  type Result,
  legalEntityFor,
  ok,
  refuse,
} from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import { accountingDocument } from "@auction/db/schema";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import type {
  AccountingClock,
  IAccountingCreditNotes,
  IAccountingDocumentLookup,
  StoredAccountingDocument,
  StoredDocumentCode,
} from "../../interfaces/accounting.js";
import { rowToStored } from "../../lib/accounting-document-row.js";

export class DrizzleAccountingDocumentReader
  implements IAccountingDocumentLookup, IAccountingCreditNotes
{
  constructor(
    private readonly db: Database,
    private readonly clock: AccountingClock,
  ) {}

  async findByReference(
    product: Product,
    reference: string,
    target?: DocumentTarget | null,
  ): Promise<Result<StoredAccountingDocument | null, StoredDocumentCode>> {
    const [row] = await this.db
      .select()
      .from(accountingDocument)
      .where(
        and(
          eq(accountingDocument.product, product),
          eq(accountingDocument.legalEntity, legalEntityFor(product)),
          eq(accountingDocument.laxReference, reference),
          target === undefined
            ? undefined
            : and(
                sql`${accountingDocument.targetProvider} is not distinct from ${target?.provider ?? null}`,
                sql`${accountingDocument.targetMode} is not distinct from ${target?.mode ?? null}`,
              ),
        ),
      )
      .orderBy(desc(accountingDocument.createdAt), desc(accountingDocument.id))
      .limit(1);
    if (!row) return ok(null);
    return rowToStored(row, this.clock.now().getTime());
  }

  async creditNotesFor(
    product: Product,
    invoiceReference: string,
    target: DocumentTarget | null,
  ): Promise<Result<readonly CreditNote[], StoredDocumentCode>> {
    const rows = await this.db
      .select()
      .from(accountingDocument)
      .where(
        and(
          eq(accountingDocument.product, product),
          eq(accountingDocument.legalEntity, legalEntityFor(product)),
          eq(accountingDocument.kind, "credit_note"),
          sql`${accountingDocument.payload} ->> 'invoiceReference' = ${invoiceReference}`,
          ne(accountingDocument.state, "cancelled"),
          sql`${accountingDocument.targetProvider} is not distinct from ${target?.provider ?? null}`,
          sql`${accountingDocument.targetMode} is not distinct from ${target?.mode ?? null}`,
        ),
      )
      .orderBy(asc(accountingDocument.createdAt), asc(accountingDocument.id));
    const nowMs = this.clock.now().getTime();
    const notes: CreditNote[] = [];
    for (const row of rows) {
      const stored = rowToStored(row, nowMs);
      if (!stored.ok) return stored;
      if (stored.value.document.kind !== "credit_note") {
        return refuse("bad_stored_document", "a credit note row holds another kind");
      }
      notes.push(stored.value.document);
    }
    return ok(notes);
  }
}
