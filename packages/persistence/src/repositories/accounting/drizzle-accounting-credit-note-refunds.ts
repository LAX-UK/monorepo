import { type TargetMode, parseLaxReference } from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import {
  accountingDocument,
  accountingDocumentEvent,
  paymentGroupDelivery,
  paymentRefund,
  shopRefund,
} from "@auction/db/schema";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type {
  AccountingClock,
  CreditNoteRefundDue,
  CreditNoteRefundDueList,
  CreditNoteRefundRecord,
  CreditNoteRefundSettle,
  IAccountingCreditNoteRefunds,
} from "../../interfaces/accounting.js";
import {
  CREDIT_NOTE_REFUND_REFUSED,
  MONEY_BACK_CREDIT_NOTE,
  REFUND_CREDIT_NOTE,
  REFUND_REVERSED_AFTER_CREDIT,
  REFUND_UNSETTLED,
} from "../../lib/accounting-credit-note-refund-due.js";
import { applyLockedTransition } from "../../lib/accounting-document-move.js";
import { rowToStored } from "../../lib/accounting-document-row.js";
import { withoutReversed } from "./drizzle-bid-accounting-facts.reader.js";

const d = accountingDocument;
const e = accountingDocumentEvent;

export { CREDIT_NOTE_REFUND_REFUSED, REFUND_CREDIT_NOTE, REFUND_REVERSED_AFTER_CREDIT };

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** A courier refund's credit note: `dlv-<quote>-r<total>`, bringing the quote's credit to <total>. */
const COURIER_SOURCE =
  /^dlv-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-r(\d+)$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Does the refund this credit note gives back still stand, read now, under the credit note's row
 * lock? The backstop for a reversal that could not hold the note itself (it was being sent, its
 * outcome unknown, and the reversal's delivery ran out of tries):
 * - a payment refund's note (`<refund id>`): no `refund_reversal` row of the payment takes that
 *   refund back (matched as the facts reader matches them);
 * - a courier refund's note (`dlv-<quote>-r<total>`): the quote's refunded total still reaches the
 *   total the note brings its credit to;
 * - a Shop refund's note (`LAX-SHOP-CN-<refund id>`): the `shop_refund` row went through by
 *   Stripe (succeeded, not settled outside it, whose money never passed through clearing).
 * Anything it cannot tell (an unknown source, a reversal that matches no refund) does not stand:
 * the money is never refunded from clearing on a guess.
 */
async function refundStillStands(tx: Tx, laxReference: string): Promise<boolean> {
  const parsed = parseLaxReference(laxReference);
  if (!parsed.ok) return false;
  const sourceId = parsed.value.sourceId;
  const courier = COURIER_SOURCE.exec(sourceId);
  if (courier) {
    const [delivery] = await tx
      .select({ refunded: sql<number | null>`max(${paymentGroupDelivery.refundedPence})` })
      .from(paymentGroupDelivery)
      .where(eq(paymentGroupDelivery.deliveryQuoteId, courier[1] as string));
    const refunded = delivery?.refunded;
    return refunded !== null && refunded !== undefined && Number(courier[2]) <= Number(refunded);
  }
  if (!UUID.test(sourceId)) return false;
  if (parsed.value.product === "shop") {
    const [refund] = await tx
      .select({ id: shopRefund.id })
      .from(shopRefund)
      .where(
        and(
          eq(shopRefund.id, sourceId),
          eq(shopRefund.status, "succeeded"),
          isNull(shopRefund.settledOutsideAt),
        ),
      );
    return refund !== undefined;
  }
  if (parsed.value.product !== "bid") return false;
  const [own] = await tx
    .select({ paymentId: paymentRefund.paymentId })
    .from(paymentRefund)
    .where(eq(paymentRefund.id, sourceId));
  if (!own) return false;
  const rows = await tx
    .select({
      id: paymentRefund.id,
      amountPence: paymentRefund.amountPence,
      source: paymentRefund.source,
      stripeRefundId: paymentRefund.stripeRefundId,
    })
    .from(paymentRefund)
    .where(eq(paymentRefund.paymentId, own.paymentId))
    .orderBy(asc(paymentRefund.createdAt), asc(paymentRefund.id));
  const kept = withoutReversed(rows);
  return kept?.some((r) => r.id.toLowerCase() === sourceId) ?? false;
}

/**
 * Issued credit notes whose money went back to the buyer, refunded in the books from Stripe
 * clearing once each. The step runs while this worker holds the credit note and is recorded in
 * its history (`refund_credit_note`) in the same transaction, so it is settled once whatever runs.
 */
export class DrizzleAccountingCreditNoteRefunds implements IAccountingCreditNoteRefunds {
  constructor(
    private readonly db: Database,
    private readonly clock: AccountingClock,
  ) {}

  async listDue(modes: readonly TargetMode[], limit: number): Promise<CreditNoteRefundDueList> {
    if (modes.length === 0 || limit <= 0) return { due: [], unreadable: [] };
    const rows = await this.db
      .select()
      .from(d)
      .where(
        and(
          MONEY_BACK_CREDIT_NOTE,
          eq(d.state, "issued"),
          eq(d.targetProvider, "books"),
          inArray(d.targetMode, [...modes]),
          REFUND_UNSETTLED,
        ),
      )
      // Least recently touched first: one whose last answer was unknown goes behind the others.
      .orderBy(asc(d.updatedAt), asc(d.id))
      .limit(limit);
    const nowMs = this.clock.now().getTime();
    const due: CreditNoteRefundDue[] = [];
    const unreadable: string[] = [];
    for (const row of rows) {
      const stored = rowToStored(row, nowMs);
      if (!stored.ok) {
        unreadable.push(row.id);
        continue;
      }
      due.push({ creditNote: stored.value });
    }
    return { due, unreadable };
  }

  async settleExclusively(
    creditNoteDocumentId: string,
    step: () => Promise<CreditNoteRefundRecord | null>,
  ): Promise<CreditNoteRefundSettle> {
    return this.db.transaction(async (tx) => {
      // Held for the step only; a worker that finds it held leaves it to the holder. Checked
      // again under the lock: a credit note settled meanwhile is not refunded twice.
      const [held] = await tx
        .select()
        .from(d)
        .where(
          and(
            eq(d.id, creditNoteDocumentId),
            MONEY_BACK_CREDIT_NOTE,
            eq(d.state, "issued"),
            REFUND_UNSETTLED,
          ),
        )
        .for("update", { skipLocked: true });
      if (!held) return "skipped";
      // Read the history again in a statement of its own: the lock above may have been taken just
      // after another worker settled and committed, which its snapshot did not yet show. Without
      // this, two refunders could both refund the note.
      const [settled] = await tx
        .select({ yes: sql<boolean>`true` })
        .from(e)
        .where(and(eq(e.documentId, held.id), eq(e.action, REFUND_CREDIT_NOTE)))
        .limit(1);
      if (settled) return "skipped";
      // The refund itself, read again under this lock: one taken back is never refunded from
      // clearing, whatever the reversal managed to do (it may have met the note being sent, and
      // run out of tries). The note is held for a person instead, as the reversal would have.
      if (!(await refundStillStands(tx, held.laxReference))) {
        const moved = await applyLockedTransition(
          tx,
          held,
          { action: "hold", reason: REFUND_REVERSED_AFTER_CREDIT },
          this.clock.now(),
        );
        if (!moved.ok)
          throw new Error(`credit note ${held.id} could not be held: ${moved.refusal.code}`);
        return "refund_reversed";
      }
      const record = await step();
      if (record === null) {
        // No answer to record: note the attempt, so the next run tries the others first.
        await tx.update(d).set({ updatedAt: this.clock.now() }).where(eq(d.id, held.id));
        return "skipped";
      }
      await tx.insert(e).values({
        documentId: held.id,
        action: REFUND_CREDIT_NOTE,
        fromState: "issued",
        toState: "issued",
        attempts: held.attempts,
        detail: {
          outcome: record.outcome,
          amountPence: record.amountPence,
          account: record.account,
          rehearsal: record.rehearsal,
          ...(record.reason ? { reason: record.reason } : {}),
        },
        occurredAt: this.clock.now(),
      });
      if (record.outcome === "rejected") {
        // Not settled for anyone: the buyer holds an open credit in Books and Stripe clearing does
        // not reconcile. The credit note is held for a person (the Books document kept), so it
        // shows in "Needs a person" until they refund it by hand in Books (see the runbook).
        const moved = await applyLockedTransition(
          tx,
          held,
          { action: "hold", reason: CREDIT_NOTE_REFUND_REFUSED },
          this.clock.now(),
        );
        if (!moved.ok)
          throw new Error(`credit note ${held.id} could not be held: ${moved.refusal.code}`);
      }
      return "settled";
    });
  }
}
