import type { TargetMode } from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import { accountingDocument, accountingDocumentCopy } from "@auction/db/schema";
import { and, eq, inArray, lt, min, ne, not, notExists, or, sql } from "drizzle-orm";
import type {
  AccountingAttention,
  IAccountingAttentionReader,
  QueueAge,
} from "../../interfaces/accounting.js";
import { AWAITED_ISSUED } from "../../lib/accounting-awaited.js";
import {
  MONEY_BACK_CREDIT_NOTE,
  REFUND_UNSETTLED,
} from "../../lib/accounting-credit-note-refund-due.js";
import { QUEUE_TAB_WHERE } from "../../lib/accounting-queue-tab.js";
import { DELIVERY_INVOICE, ISSUED_AT, UNSETTLED } from "../../lib/accounting-remainder-due.js";

const d = accountingDocument;

export class DrizzleAccountingAttentionReader implements IAccountingAttentionReader {
  constructor(private readonly db: Database) {}

  async read(pendingModes: readonly TargetMode[]): Promise<AccountingAttention> {
    const [needsPerson, pending] = await Promise.all([
      this.age(QUEUE_TAB_WHERE.needs_person),
      pendingModes.length === 0
        ? Promise.resolve<QueueAge>({ count: 0, oldestSince: null })
        : this.age(
            and(
              eq(d.state, "pending"),
              eq(d.targetProvider, "books"),
              inArray(d.targetMode, [...pendingModes]),
              // Waiting for another document is not the sender missing it.
              AWAITED_ISSUED,
            ),
          ),
    ]);
    return { needsPerson, pending };
  }

  async delayedBidInvoices(modes: readonly TargetMode[], queuedBefore: Date): Promise<QueueAge> {
    if (modes.length === 0) return { count: 0, oldestSince: null };
    const copied = this.db
      .select({ one: sql`1` })
      .from(accountingDocumentCopy)
      .where(eq(accountingDocumentCopy.documentId, d.id));
    const [row] = await this.db
      .select({ count: sql<number>`count(*)`.mapWith(Number), oldest: min(d.createdAt) })
      .from(d)
      .where(
        and(
          eq(d.product, "bid"),
          eq(d.kind, "invoice"),
          eq(d.targetProvider, "books"),
          inArray(d.targetMode, [...modes]),
          ne(d.state, "cancelled"),
          lt(d.createdAt, queuedBefore),
          or(ne(d.state, "issued"), notExists(copied)),
        ),
      );
    return { count: row?.count ?? 0, oldestSince: row?.oldest ?? null };
  }

  async waitingPayments(modes: readonly TargetMode[], queuedBefore: Date): Promise<QueueAge> {
    if (modes.length === 0) return { count: 0, oldestSince: null };
    const [row] = await this.db
      .select({ count: sql<number>`count(*)`.mapWith(Number), oldest: min(d.createdAt) })
      .from(d)
      .where(
        and(
          eq(d.kind, "payment"),
          eq(d.state, "pending"),
          eq(d.targetProvider, "books"),
          inArray(d.targetMode, [...modes]),
          lt(d.createdAt, queuedBefore),
          not(AWAITED_ISSUED),
        ),
      );
    return { count: row?.count ?? 0, oldestSince: row?.oldest ?? null };
  }

  async unsettledRemainders(modes: readonly TargetMode[], issuedBefore: Date): Promise<QueueAge> {
    if (modes.length === 0) return { count: 0, oldestSince: null };
    const [row] = await this.db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        oldest: sql<string | null>`min(${ISSUED_AT})`,
      })
      .from(d)
      .where(
        and(
          DELIVERY_INVOICE,
          eq(d.state, "issued"),
          eq(d.targetProvider, "books"),
          inArray(d.targetMode, [...modes]),
          UNSETTLED,
          sql`${ISSUED_AT} < ${issuedBefore.toISOString()}::timestamptz`,
        ),
      );
    const oldest = row?.oldest ?? null;
    return { count: row?.count ?? 0, oldestSince: oldest === null ? null : new Date(oldest) };
  }

  async unrefundedCreditNotes(modes: readonly TargetMode[], issuedBefore: Date): Promise<QueueAge> {
    if (modes.length === 0) return { count: 0, oldestSince: null };
    const [row] = await this.db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        oldest: sql<string | null>`min(${ISSUED_AT})`,
      })
      .from(d)
      .where(
        and(
          MONEY_BACK_CREDIT_NOTE,
          eq(d.state, "issued"),
          eq(d.targetProvider, "books"),
          inArray(d.targetMode, [...modes]),
          REFUND_UNSETTLED,
          sql`${ISSUED_AT} < ${issuedBefore.toISOString()}::timestamptz`,
        ),
      );
    const oldest = row?.oldest ?? null;
    return { count: row?.count ?? 0, oldestSince: oldest === null ? null : new Date(oldest) };
  }

  private async age(where: ReturnType<typeof and>): Promise<QueueAge> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)`.mapWith(Number), oldest: min(d.updatedAt) })
      .from(d)
      .where(where);
    return { count: row?.count ?? 0, oldestSince: row?.oldest ?? null };
  }
}
