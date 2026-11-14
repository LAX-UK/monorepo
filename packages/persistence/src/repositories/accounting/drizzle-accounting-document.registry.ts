import { isDeepStrictEqual } from "node:util";
import {
  type CreditNote,
  type DocumentTarget,
  type Product,
  type Result,
  documentTarget,
  legalEntityFor,
  ok,
  parkedRecord,
  refuse,
} from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import {
  accountingDocument,
  accountingDocumentEvent,
  accountingSourceSetting,
  paymentGroupDelivery,
  paymentRefund,
  shopRefund,
} from "@auction/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import type {
  AccountingClock,
  CreditBasis,
  IAccountingDocumentRegistry,
  RegisterCode,
  RegisterInput,
  RegisterOutcome,
} from "../../interfaces/accounting.js";
import { REFUND_REVERSED_AFTER_CREDIT } from "../../lib/accounting-credit-note-refund-due.js";
import { readDocumentPayload } from "../../lib/accounting-document-payload.js";
import { documentTotals } from "../../lib/accounting-document-payload.js";
import { rowToStored } from "../../lib/accounting-document-row.js";

export class DrizzleAccountingDocumentRegistry implements IAccountingDocumentRegistry {
  constructor(
    private readonly db: Database,
    private readonly clock: AccountingClock,
  ) {}

  async register(input: RegisterInput): Promise<Result<RegisterOutcome, RegisterCode>> {
    const { document, sourceEventRef, park, creditBasis } = input;
    const checked = readDocumentPayload(document, {
      product: document.product,
      kind: document.kind,
      reference: document.reference,
    });
    if (!checked.ok) return refuse("bad_document", checked.refusal.message);
    if (sourceEventRef.trim() === "")
      return refuse("bad_document", "source event reference is empty");
    const payload = JSON.parse(JSON.stringify(checked.value)) as Record<string, unknown>;
    const totals = documentTotals(checked.value);
    const at = this.clock.now();
    // A parked document is stored straight into needs_review (never pending first), so no sender
    // can claim it between two writes.
    const parked = park ? parkedRecord(document.kind, document.reference, park) : null;
    const parkedColumns =
      parked?.status === "needs_review" && parked.lookup === "clear"
        ? {
            state: "needs_review" as const,
            reviewLookup: "clear" as const,
            needsReviewReason: parked.reason,
          }
        : {};

    return this.db.transaction(async (tx) => {
      // The document is aimed, once, at the provider and mode the switch names as it is created.
      // No row for the product (never seeded) means no target, so nobody takes the document.
      // A reference is held once per target: a rehearsal (`dry_run`) row never stands in for
      // the test or live organisation, so when the switch moves on, the same reference is queued
      // again, `pending`, for the new target. The rows with no target share one slot.
      const [setting] = await tx
        .select()
        .from(accountingSourceSetting)
        .where(eq(accountingSourceSetting.product, document.product));
      const target = setting
        ? documentTarget({ xero: setting.xeroMode, books: setting.booksMode })
        : null;
      if (document.kind === "credit_note") {
        const fits = await creditFitsInvoice(tx, document, target, creditBasis);
        if (!fits.ok) return fits;
      }
      const [inserted] = await tx
        .insert(accountingDocument)
        .values({
          product: document.product,
          legalEntity: legalEntityFor(document.product),
          kind: document.kind,
          laxReference: document.reference,
          sourceEventRef,
          payload,
          ...totals,
          targetProvider: target?.provider ?? null,
          targetMode: target?.mode ?? null,
          ...parkedColumns,
          createdAt: at,
          updatedAt: at,
        })
        .onConflictDoNothing({
          target: [
            accountingDocument.product,
            accountingDocument.legalEntity,
            accountingDocument.laxReference,
            accountingDocument.targetProvider,
            accountingDocument.targetMode,
          ],
        })
        .returning();
      if (inserted) {
        await tx.insert(accountingDocumentEvent).values({
          documentId: inserted.id,
          action: "created",
          fromState: null,
          toState: inserted.state,
          attempts: 0,
          detail: park ? { sourceEventRef, target, parked: park } : { sourceEventRef, target },
          occurredAt: at,
        });
        const stored = rowToStored(inserted, at.getTime());
        return stored.ok
          ? ok({ created: true, stored: stored.value })
          : refuse("bad_document", stored.refusal.message);
      }
      // The reference is taken for this target. The same document again is a replay (its state is
      // left as it is: parked or not, it was decided when it was first stored); a different one is
      // a bug.
      const [existing] = await tx
        .select()
        .from(accountingDocument)
        .where(
          and(
            eq(accountingDocument.product, document.product),
            eq(accountingDocument.legalEntity, legalEntityFor(document.product)),
            eq(accountingDocument.laxReference, document.reference),
            sql`${accountingDocument.targetProvider} is not distinct from ${target?.provider ?? null}`,
            sql`${accountingDocument.targetMode} is not distinct from ${target?.mode ?? null}`,
          ),
        );
      if (!existing || !isDeepStrictEqual(existing.payload, payload)) {
        return refuse("reference_in_use", "that reference holds a different document");
      }
      const stored = rowToStored(existing, at.getTime());
      return stored.ok
        ? ok({ created: false, stored: stored.value })
        : refuse("bad_document", stored.refusal.message);
    });
  }

  async awaitCreditRegistrations(
    product: Product,
    invoiceReference: string,
    target: DocumentTarget | null,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${creditLockKey(product, invoiceReference, target)}, 0))`,
      );
    });
  }
}

/** The transaction lock every credit note of one invoice in one books is registered under. */
function creditLockKey(
  product: Product,
  invoiceReference: string,
  target: DocumentTarget | null,
): string {
  return `accounting_credit:${product}:${legalEntityFor(product)}:${invoiceReference}:${target?.provider ?? "-"}:${target?.mode ?? "-"}`;
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Never more credit than the invoice charged, whoever registers at the same time. The invoice's
 * credit notes in the same books are serialised by a transaction lock on (invoice, target), so
 * two registrations can never both read the old total; the new credit note must fit in the
 * invoice's gross less every other credit note registered for it there (any state but cancelled:
 * a failed one may still be tried again), except one held because its refund was taken back
 * (`accounting_refund_reversed_after_credit`): that money never reached the buyer, so a later
 * refund that did is credited. The basis below still reads every one of them, as the flows do. The invoice must be registered there, and not only
 * cancelled. A replay of this credit note is not counted against itself.
 *
 * With a basis, the note must also have been built from what holds now, under the same lock: the
 * same other credit, the same refund rows of the payment, or the same refunded total of the
 * courier quote (and a courier refund's notes never credit more than that total). Otherwise it is
 * refused (`credit_prior_changed`) and projected again from fresh facts.
 */
async function creditFitsInvoice(
  tx: Tx,
  note: CreditNote,
  target: DocumentTarget | null,
  basis: CreditBasis | undefined,
): Promise<Result<true, RegisterCode>> {
  const entity = legalEntityFor(note.product);
  const sameBooks = and(
    eq(accountingDocument.product, note.product),
    eq(accountingDocument.legalEntity, entity),
    sql`${accountingDocument.targetProvider} is not distinct from ${target?.provider ?? null}`,
    sql`${accountingDocument.targetMode} is not distinct from ${target?.mode ?? null}`,
  );
  const lockKey = creditLockKey(note.product, note.invoiceReference, target);
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
  const [invoice] = await tx
    .select({ grossPence: accountingDocument.grossPence })
    .from(accountingDocument)
    .where(
      and(
        sameBooks,
        eq(accountingDocument.kind, "invoice"),
        eq(accountingDocument.laxReference, note.invoiceReference),
        ne(accountingDocument.state, "cancelled"),
      ),
    );
  if (!invoice) {
    return refuse("credit_without_invoice", "the invoice it credits is not in these books");
  }
  const [credited] = await tx
    .select({
      pence: sql<string>`coalesce(sum(${accountingDocument.grossPence}), 0)::bigint`,
      // Held as taken back: the buyer never had that money, and the note waits for the accountant
      // to reverse it in Books. It does not stand in the way of a later refund that went through.
      reversedPence: sql<string>`coalesce(sum(${accountingDocument.grossPence}) filter (where ${accountingDocument.state} = 'needs_review' and ${accountingDocument.needsReviewReason} = ${REFUND_REVERSED_AFTER_CREDIT}), 0)::bigint`,
    })
    .from(accountingDocument)
    .where(
      and(
        sameBooks,
        eq(accountingDocument.kind, "credit_note"),
        sql`${accountingDocument.payload} ->> 'invoiceReference' = ${note.invoiceReference}`,
        ne(accountingDocument.laxReference, note.reference),
        ne(accountingDocument.state, "cancelled"),
      ),
    );
  const already = Number(credited?.pence ?? 0);
  const standing = already - Number(credited?.reversedPence ?? 0);
  if (standing + note.totals.grossPence > invoice.grossPence) {
    return refuse(
      "credit_exceeds_invoice",
      `${standing}p already credited; ${note.totals.grossPence}p more exceeds the invoice's ${invoice.grossPence}p`,
    );
  }
  return basis ? basisHolds(tx, note, basis, already) : ok(true);
}

const changed = (what: string) =>
  refuse("credit_prior_changed" as const, `${what} changed since the facts were read`);

/** The basis the note was built from, read again under the invoice's credit lock. */
async function basisHolds(
  tx: Tx,
  note: CreditNote,
  basis: CreditBasis,
  already: number,
): Promise<Result<true, RegisterCode>> {
  switch (basis.kind) {
    case "invoice_credit":
      return already === basis.priorCreditPence ? ok(true) : changed("the invoice's credit");
    case "payment_refunds": {
      const [row] = await tx
        .select({ rows: sql<number>`count(*)`.mapWith(Number) })
        .from(paymentRefund)
        .where(eq(paymentRefund.paymentId, basis.paymentId));
      return (row?.rows ?? 0) === basis.refundRows ? ok(true) : changed("the payment's refunds");
    }
    case "shop_refunds": {
      // A refund that went through since the facts were read: built again with it.
      const [row] = await tx
        .select({ rows: sql<number>`count(*)`.mapWith(Number) })
        .from(shopRefund)
        .where(and(eq(shopRefund.orderId, basis.orderId), eq(shopRefund.status, "succeeded")));
      if ((row?.rows ?? 0) !== basis.succeededRefunds) return changed("the order's refunds");
      // A new note fits on the lines only after exactly the credit it was built after (a replay of
      // a stored note is not new, and is checked by its payload).
      const built = basis.builtAfter.find((b) => b.reference === note.reference);
      if (built && already !== built.priorCreditPence) return changed("the invoice's credit");
      return ok(true);
    }
    case "delivery_refund": {
      if (already !== basis.priorCreditPence) return changed("the delivery invoice's credit");
      const [delivery] = await tx
        .select({
          refundedPence: paymentGroupDelivery.refundedPence,
          chargedPence: sql<string>`(${paymentGroupDelivery.amount} * 100)::bigint`,
        })
        .from(paymentGroupDelivery)
        .where(
          and(
            eq(paymentGroupDelivery.paymentGroupId, basis.groupId),
            eq(paymentGroupDelivery.deliveryQuoteId, basis.quoteId),
          ),
        );
      if (!delivery || delivery.refundedPence !== basis.refundedPence) {
        return changed("the courier quote's refunded total");
      }
      const ceiling = Math.min(delivery.refundedPence, Number(delivery.chargedPence));
      if (already + note.totals.grossPence > ceiling) {
        return refuse(
          "credit_exceeds_refunded",
          `${already}p already credited; ${note.totals.grossPence}p more exceeds the ${ceiling}p refunded`,
        );
      }
      return ok(true);
    }
  }
}
