import { MAX_SEND_ATTEMPTS, retryDelayMs } from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import { accountingDocument } from "@auction/db/schema";
import { type SQL, and, asc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import type {
  AccountingClock,
  DueWork,
  DueWorkRequest,
  IAccountingDocumentDueWork,
  StoredAccountingDocument,
} from "../../interfaces/accounting.js";
import { rowToStored } from "../../lib/accounting-document-row.js";

/**
 * `column` is at least `retryDelayMs(attempts)` in the past. The schedule lives in the domain; this
 * spells it out per attempt count, so the database and the domain cannot disagree. A document that
 * has used every attempt is due at once (a person takes it).
 */
function waited(
  column: typeof accountingDocument.settlesAt | typeof accountingDocument.updatedAt,
  nowMs: number,
): SQL {
  const steps: SQL[] = [];
  for (let attempts = 1; attempts < MAX_SEND_ATTEMPTS; attempts += 1) {
    const before = new Date(nowMs - retryDelayMs(attempts));
    steps.push(and(eq(accountingDocument.attempts, attempts), lte(column, before)) as SQL);
  }
  steps.push(
    and(gte(accountingDocument.attempts, MAX_SEND_ATTEMPTS), lte(column, new Date(nowMs))) as SQL,
  );
  return or(...steps) as SQL;
}

export class DrizzleAccountingDocumentDueWork implements IAccountingDocumentDueWork {
  constructor(
    private readonly db: Database,
    private readonly clock: AccountingClock,
  ) {}

  async listDue(request: DueWorkRequest): Promise<DueWork> {
    if (request.targetModes.length === 0 || request.limit <= 0) {
      return { documents: [], unreadable: [] };
    }
    const nowMs = this.clock.now().getTime();
    const transient =
      request.transientErrorPrefixes.length > 0
        ? or(
            ...request.transientErrorPrefixes.map(
              (prefix) => sql`starts_with(${accountingDocument.lastErrorClass}, ${prefix})`,
            ),
          )
        : sql`false`;
    const rows = await this.db
      .select()
      .from(accountingDocument)
      .where(
        and(
          eq(accountingDocument.targetProvider, request.provider),
          inArray(accountingDocument.targetMode, [...request.targetModes]),
          or(
            and(
              eq(accountingDocument.state, "unknown"),
              waited(accountingDocument.settlesAt, nowMs),
            ),
            and(
              eq(accountingDocument.state, "failed"),
              transient,
              waited(accountingDocument.updatedAt, nowMs),
            ),
          ),
        ),
      )
      .orderBy(asc(accountingDocument.updatedAt), asc(accountingDocument.id))
      .limit(request.limit);
    const documents: StoredAccountingDocument[] = [];
    const unreadable: string[] = [];
    for (const row of rows) {
      const stored = rowToStored(row, nowMs);
      if (stored.ok) documents.push(stored.value);
      else unreadable.push(row.id);
    }
    return { documents, unreadable };
  }
}
