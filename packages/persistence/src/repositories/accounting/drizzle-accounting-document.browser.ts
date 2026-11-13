import { QUEUE_TABS, type QueueTab, type Result, ok } from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import { accountingDocument } from "@auction/db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type {
  AccountingClock,
  AccountingQueuePage,
  AccountingQueueQuery,
  IAccountingDocumentBrowser,
  StoredAccountingDocument,
  StoredDocumentCode,
} from "../../interfaces/accounting.js";
import { rowToStored } from "../../lib/accounting-document-row.js";
import { QUEUE_TAB_WHERE } from "../../lib/accounting-queue-tab.js";

const d = accountingDocument;

export class DrizzleAccountingDocumentBrowser implements IAccountingDocumentBrowser {
  constructor(
    private readonly db: Database,
    private readonly clock: AccountingClock,
  ) {}

  async list(query: AccountingQueueQuery): Promise<AccountingQueuePage> {
    const entity = query.legalEntity === null ? undefined : eq(d.legalEntity, query.legalEntity);
    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(d)
        .where(and(QUEUE_TAB_WHERE[query.tab], entity))
        .orderBy(...orderFor(query.tab))
        .limit(query.limit)
        .offset(query.offset),
      this.db
        .select(
          Object.fromEntries(
            QUEUE_TABS.map((tab) => [
              tab,
              sql<number>`count(*) filter (where ${QUEUE_TAB_WHERE[tab]})`.mapWith(Number),
            ]),
          ) as Record<QueueTab, ReturnType<typeof sql<number>>>,
        )
        .from(d)
        .where(entity),
    ]);
    const nowMs = this.clock.now().getTime();
    const documents: StoredAccountingDocument[] = [];
    const unreadable: string[] = [];
    for (const row of rows) {
      const stored = rowToStored(row, nowMs);
      if (stored.ok) documents.push(stored.value);
      else unreadable.push(row.id);
    }
    const counted = countRows[0];
    const counts = Object.fromEntries(
      QUEUE_TABS.map((tab) => [tab, Number(counted?.[tab] ?? 0)]),
    ) as Record<QueueTab, number>;
    return { documents, unreadable, total: counts[query.tab], counts };
  }

  async findById(id: string): Promise<Result<StoredAccountingDocument | null, StoredDocumentCode>> {
    const [row] = await this.db.select().from(d).where(eq(d.id, id)).limit(1);
    if (!row) return ok(null);
    return rowToStored(row, this.clock.now().getTime());
  }
}

/** What needs doing waits oldest first; what reached the books shows the newest first. */
function orderFor(tab: QueueTab) {
  return tab === "issued" ? [desc(d.updatedAt), desc(d.id)] : [asc(d.updatedAt), asc(d.id)];
}
