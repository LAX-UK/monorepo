import { type Product, type Result, legalEntityFor, ok } from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import { accountingDocument } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
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
  ): Promise<Result<StoredAccountingDocument | null, StoredDocumentCode>> {
    const [row] = await this.db
      .select()
      .from(accountingDocument)
      .where(
        and(
          eq(accountingDocument.product, product),
          eq(accountingDocument.legalEntity, legalEntityFor(product)),
          eq(accountingDocument.laxReference, reference),
        ),
      );
    if (!row) return ok(null);
    return rowToStored(row, this.clock.now().getTime());
  }
}
