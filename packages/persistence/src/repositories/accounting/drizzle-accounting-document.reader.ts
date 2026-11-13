import {
  type DocumentTarget,
  type Product,
  type Result,
  legalEntityFor,
  ok,
} from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import { accountingDocument } from "@auction/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import type {
  AccountingClock,
  IAccountingDocumentLookup,
  StoredAccountingDocument,
  StoredDocumentCode,
} from "../../interfaces/accounting.js";
import { rowToStored } from "../../lib/accounting-document-row.js";

export class DrizzleAccountingDocumentReader implements IAccountingDocumentLookup {
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
}
