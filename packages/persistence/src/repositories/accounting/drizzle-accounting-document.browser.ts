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
    const reference =
      query.reference === null || query.reference === undefined
        ? undefined
        : eq(d.laxReference, query.reference);
    // Issued today, in London: Postgres decides the day (the clock changes over the year), against
    // the same clock the rows are stamped with, so "today" means the app's today, not the server's.
    const today = this.clock.now();
    const issuedToday = sql<number>`count(*) filter (where ${d.state} = 'issued' and (${d.updatedAt} at time zone 'Europe/London')::date = (${today}::timestamptz at time zone 'Europe/London')::date)`;
    const [rows, countRows, lastSentRows] = await Promise.all([
      this.db
        .select()
        .from(d)
        .where(and(QUEUE_TAB_WHERE[query.tab], entity, reference))
        .orderBy(...orderFor(query.tab))
        .limit(query.limit)
        .offset(query.offset),
      this.db
        .select({
          ...(Object.fromEntries(
            QUEUE_TABS.map((tab) => [
              tab,
              sql<number>`count(*) filter (where ${QUEUE_TAB_WHERE[tab]})`.mapWith(Number),
            ]),
          ) as Record<QueueTab, ReturnType<typeof sql<number>>>),
          issuedToday: issuedToday.mapWith(Number),
        })
        // The tab counts and "issued today" follow the company, not the tab or the reference search.
        .from(d)
        .where(entity),
      this.db
        .select({ at: d.updatedAt, mode: d.targetMode })
        .from(d)
        .where(and(eq(d.state, "issued"), entity))
        .orderBy(desc(d.updatedAt), desc(d.id))
        .limit(1),
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
    const lastSentRow = lastSentRows[0];
    const lastSent =
      lastSentRow?.at != null
        ? { at: lastSentRow.at, rehearsal: lastSentRow.mode === "dry_run" }
        : null;
    // A reference search narrows the tab, so the total is how many match it, not the whole tab.
    let total = counts[query.tab];
    if (reference) {
      const [matched] = await this.db
        .select({ total: sql<number>`count(*)`.mapWith(Number) })
        .from(d)
        .where(and(QUEUE_TAB_WHERE[query.tab], entity, reference));
      total = matched?.total ?? 0;
    }
    return {
      documents,
      unreadable,
      total,
      counts,
      issuedToday: Number(counted?.issuedToday ?? 0),
      lastSent,
    };
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
