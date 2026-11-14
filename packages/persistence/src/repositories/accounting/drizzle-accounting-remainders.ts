import { type TargetMode, shopDeliveryPaymentReference } from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import { accountingDocument, accountingDocumentEvent } from "@auction/db/schema";
import { and, asc, eq, inArray, like, notExists, sql } from "drizzle-orm";
import type {
  AccountingClock,
  IAccountingRemainders,
  RemainderDue,
  RemainderDueList,
  RemainderRecord,
} from "../../interfaces/accounting.js";
import { rowToStored } from "../../lib/accounting-document-row.js";

const d = accountingDocument;
const e = accountingDocumentEvent;

/** The history action that settles a remainder (migration 0383). */
export const APPLY_REMAINDER = "apply_remainder";

/** Shop outside-UK delivery invoices: `LAX-SHOP-INV-<order>-delivery`. */
const DELIVERY_INVOICE = and(
  eq(d.product, "shop"),
  eq(d.kind, "invoice"),
  like(d.laxReference, "LAX-SHOP-INV-%-delivery"),
);

const UNSETTLED = notExists(
  sql`(select 1 from ${e} where ${e.documentId} = ${d.id} and ${e.action} = ${APPLY_REMAINDER})`,
);

export class DrizzleAccountingRemainders implements IAccountingRemainders {
  constructor(
    private readonly db: Database,
    private readonly clock: AccountingClock,
  ) {}

  async listDue(modes: readonly TargetMode[], limit: number): Promise<RemainderDueList> {
    if (modes.length === 0) return { due: [], unreadable: [] };
    const invoices = await this.db
      .select()
      .from(d)
      .where(
        and(
          DELIVERY_INVOICE,
          eq(d.state, "issued"),
          eq(d.targetProvider, "books"),
          inArray(d.targetMode, [...modes]),
          UNSETTLED,
        ),
      )
      .orderBy(asc(d.updatedAt), asc(d.id))
      .limit(limit);
    const nowMs = this.clock.now().getTime();
    const due: RemainderDue[] = [];
    const unreadable: string[] = [];
    for (const row of invoices) {
      const paymentReference = shopDeliveryPaymentReference(row.laxReference);
      const invoice = rowToStored(row, nowMs);
      if (paymentReference === null || !invoice.ok) {
        unreadable.push(row.id);
        continue;
      }
      // The order's payment in the same books, issued there: until it is, nothing to apply yet.
      const [paymentRow] = await this.db
        .select()
        .from(d)
        .where(
          and(
            eq(d.product, row.product),
            eq(d.legalEntity, row.legalEntity),
            eq(d.kind, "payment"),
            eq(d.laxReference, paymentReference),
            eq(d.state, "issued"),
            sql`${d.targetProvider} is not distinct from ${row.targetProvider}`,
            sql`${d.targetMode} is not distinct from ${row.targetMode}`,
          ),
        )
        .limit(1);
      if (!paymentRow) continue;
      const payment = rowToStored(paymentRow, nowMs);
      if (!payment.ok) {
        unreadable.push(row.id);
        continue;
      }
      due.push({ invoice: invoice.value, payment: payment.value });
    }
    return { due, unreadable };
  }

  async settleExclusively(
    invoiceDocumentId: string,
    step: () => Promise<RemainderRecord | null>,
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      // Held for the step only; a worker that finds it held leaves it to the holder.
      const [held] = await tx
        .select({ id: d.id, attempts: d.attempts })
        .from(d)
        .where(and(eq(d.id, invoiceDocumentId), DELIVERY_INVOICE, eq(d.state, "issued"), UNSETTLED))
        .for("update", { skipLocked: true });
      if (!held) return false;
      const record = await step();
      if (record === null) return false;
      await tx.insert(e).values({
        documentId: held.id,
        action: APPLY_REMAINDER,
        fromState: "issued",
        toState: "issued",
        attempts: held.attempts,
        detail: {
          outcome: record.outcome,
          paymentReference: record.paymentReference,
          amountPence: record.amountPence,
          rehearsal: record.rehearsal,
          ...(record.reason ? { reason: record.reason } : {}),
        },
        occurredAt: this.clock.now(),
      });
      return true;
    });
  }
}
