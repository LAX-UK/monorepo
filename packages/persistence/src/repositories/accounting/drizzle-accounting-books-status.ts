import {
  type BooksStatusDecision,
  type BooksStatusSnapshot,
  type DocumentTarget,
  type LaxPaymentsInBooks,
  type LegalEntity,
  STATUS_CHECKED_KINDS,
  type StatusCheckedKind,
  type TargetMode,
  isBooksState,
} from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import {
  accountingBooksStatus,
  accountingBooksStatusChange,
  accountingBooksStatusRun,
  accountingDocument,
} from "@auction/db/schema";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import type {
  AccountingClock,
  BooksStatusDue,
  BooksStatusDueList,
  BooksStatusRunCounts,
  BooksStatusRunOutcome,
  IAccountingBooksStatusStore,
} from "../../interfaces/accounting.js";
import { rowToStored } from "../../lib/accounting-document-row.js";

const d = accountingDocument;
const s = accountingBooksStatus;
const ISSUED_BOOKS = and(
  eq(d.state, "issued"),
  eq(d.targetProvider, "books"),
  inArray(d.kind, [...STATUS_CHECKED_KINDS]),
);

type StatusRow = typeof accountingBooksStatus.$inferSelect;

/**
 * A LAX payment document in any other state (pending, sending, unknown, needs review, failed) may
 * be in Books already without LAX knowing its Books id.
 */
const SETTLED_PAYMENT_STATES: ReadonlySet<string> = new Set(["issued", "cancelled"]);

function snapshotOf(row: StatusRow | null): BooksStatusSnapshot | null {
  if (!row || row.booksState === null) return null;
  const state = row.booksState === "missing" ? "missing" : row.booksState;
  if (state !== "missing" && !isBooksState(state)) return null;
  return {
    state,
    balancePence: row.balancePence,
    paymentIds: Array.isArray(row.paymentIds)
      ? row.paymentIds.filter((p) => typeof p === "string")
      : [],
  };
}

export class DrizzleAccountingBooksStatusStore implements IAccountingBooksStatusStore {
  constructor(
    private readonly db: Database,
    private readonly clock: AccountingClock,
  ) {}

  async listDue(
    modes: readonly TargetMode[],
    readSince: Date,
    limit: number,
  ): Promise<BooksStatusDueList> {
    if (modes.length === 0 || limit <= 0) return { documents: [], unreadable: [] };
    const rows = await this.db
      .select({ document: d, status: s })
      .from(d)
      .leftJoin(s, eq(s.documentId, d.id))
      .where(
        and(
          ISSUED_BOOKS,
          inArray(d.targetMode, [...modes]),
          or(isNull(s.checkedAt), lt(s.checkedAt, readSince), isNotNull(s.recheckRequestedAt)),
        ),
      )
      .orderBy(
        sql`${s.recheckRequestedAt} desc nulls last`,
        sql`${s.checkedAt} asc nulls first`,
        asc(d.id),
      )
      .limit(limit);
    return this.toDue(rows);
  }

  async findDue(documentId: string): Promise<BooksStatusDue | null> {
    const rows = await this.db
      .select({ document: d, status: s })
      .from(d)
      .leftJoin(s, eq(s.documentId, d.id))
      .where(and(ISSUED_BOOKS, eq(d.id, documentId)))
      .limit(1);
    return this.toDue(rows).documents[0] ?? null;
  }

  async laxPaymentsFor(
    invoice: {
      readonly legalEntity: LegalEntity;
      readonly target: DocumentTarget;
      readonly reference: string;
    },
    providerIds: readonly string[],
  ): Promise<LaxPaymentsInBooks> {
    // Applied to this invoice: the payment's allocations name its LAX reference.
    const appliedToInvoice = sql`${d.payload} -> 'allocations' @> ${JSON.stringify([
      { invoiceReference: invoice.reference },
    ])}::jsonb`;
    const rows = await this.db
      .select({
        providerId: d.providerId,
        reference: d.laxReference,
        state: d.state,
        applied: sql<boolean>`${appliedToInvoice}`,
      })
      .from(d)
      .where(
        and(
          eq(d.kind, "payment"),
          eq(d.legalEntity, invoice.legalEntity),
          eq(d.targetProvider, invoice.target.provider),
          eq(d.targetMode, invoice.target.mode),
          providerIds.length > 0
            ? or(inArray(d.providerId, [...providerIds]), appliedToInvoice)
            : appliedToInvoice,
        ),
      );
    const wanted = new Set(providerIds);
    const applied = rows.filter((r) => r.applied);
    return {
      // Whatever state LAX's document is in, a Books id LAX holds for it is LAX's payment.
      providerIds: new Set(
        rows.flatMap((r) =>
          r.providerId !== null && wanted.has(r.providerId) ? [r.providerId] : [],
        ),
      ),
      referencesWithoutProviderId: new Set(
        applied.flatMap((r) => (r.providerId === null ? [r.reference] : [])),
      ),
      unresolved: applied.some((r) => !SETTLED_PAYMENT_STATES.has(r.state)),
    };
  }

  async record(
    tx: Database,
    documentId: string,
    decision: BooksStatusDecision,
    observedAt: Date,
  ): Promise<void> {
    const changed = decision.changes.length > 0;
    await tx
      .insert(s)
      .values({
        documentId,
        booksState: decision.snapshot.state,
        balancePence: decision.snapshot.balancePence,
        paymentIds: [...decision.snapshot.paymentIds],
        checkedAt: observedAt,
        changedAt: changed ? observedAt : null,
        recheckRequestedAt: null,
      })
      .onConflictDoUpdate({
        target: s.documentId,
        set: {
          booksState: decision.snapshot.state,
          balancePence: decision.snapshot.balancePence,
          paymentIds: [...decision.snapshot.paymentIds],
          checkedAt: observedAt,
          ...(changed ? { changedAt: observedAt } : {}),
          recheckRequestedAt: null,
        },
      });
    for (const change of decision.changes) {
      if (change.kind === "state_changed") {
        await tx.insert(accountingBooksStatusChange).values({
          documentId,
          change: "state_changed",
          fromState: change.from,
          toState: change.to,
          observedAt,
        });
      } else {
        await tx
          .insert(accountingBooksStatusChange)
          .values({
            documentId,
            change: "payment_recorded_in_books",
            booksPaymentId: change.payment.providerPaymentId,
            amountPence: change.payment.amountPence,
            observedAt,
          })
          // Held once per document and Books id (index 0385): a second sight changes nothing.
          .onConflictDoNothing();
      }
    }
  }

  async requestRecheck(
    modes: readonly TargetMode[],
    legalEntity: LegalEntity,
    kind: StatusCheckedKind,
    providerId: string,
    at: Date,
    limit: number,
  ): Promise<readonly string[]> {
    if (modes.length === 0 || limit <= 0) return [];
    const rows = await this.db
      .select({ id: d.id })
      .from(d)
      .where(
        and(
          ISSUED_BOOKS,
          inArray(d.targetMode, [...modes]),
          eq(d.legalEntity, legalEntity),
          eq(d.kind, kind),
          eq(d.providerId, providerId),
        ),
      )
      .orderBy(desc(d.createdAt), asc(d.id))
      .limit(limit);
    for (const row of rows) {
      await this.db
        .insert(s)
        .values({ documentId: row.id, recheckRequestedAt: at })
        .onConflictDoUpdate({ target: s.documentId, set: { recheckRequestedAt: at } });
    }
    return rows.map((row) => row.id);
  }

  async startRun(at: Date): Promise<string> {
    const [row] = await this.db
      .insert(accountingBooksStatusRun)
      .values({ startedAt: at })
      .returning({ id: accountingBooksStatusRun.id });
    if (!row) throw new Error("accounting_books_status_run_not_created");
    return row.id;
  }

  async finishRun(
    runId: string,
    outcome: BooksStatusRunOutcome,
    counts: BooksStatusRunCounts,
    at: Date,
  ): Promise<void> {
    await this.db
      .update(accountingBooksStatusRun)
      .set({ finishedAt: at, outcome, ...counts })
      .where(
        and(eq(accountingBooksStatusRun.id, runId), isNull(accountingBooksStatusRun.finishedAt)),
      );
  }

  async lastFinishedRunAt(): Promise<Date | null> {
    const [row] = await this.db
      .select({ at: accountingBooksStatusRun.finishedAt })
      .from(accountingBooksStatusRun)
      .where(
        and(
          isNotNull(accountingBooksStatusRun.finishedAt),
          ne(accountingBooksStatusRun.outcome, "failed"),
        ),
      )
      .orderBy(desc(accountingBooksStatusRun.finishedAt))
      .limit(1);
    return row?.at ?? null;
  }

  private toDue(
    rows: readonly { document: typeof d.$inferSelect; status: StatusRow | null }[],
  ): BooksStatusDueList {
    const nowMs = this.clock.now().getTime();
    const documents: BooksStatusDue[] = [];
    const unreadable: string[] = [];
    for (const row of rows) {
      const stored = rowToStored(row.document, nowMs);
      if (stored.ok && stored.value.record.status === "issued") {
        documents.push({ stored: stored.value, previous: snapshotOf(row.status) });
      } else {
        unreadable.push(row.document.id);
      }
    }
    return { documents, unreadable };
  }
}
