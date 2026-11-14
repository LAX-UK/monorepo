import { isDeepStrictEqual } from "node:util";
import {
  type CreditNote,
  type DocumentTarget,
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
} from "@auction/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import type {
  AccountingClock,
  IAccountingDocumentRegistry,
  RegisterCode,
  RegisterInput,
  RegisterOutcome,
} from "../../interfaces/accounting.js";
import { readDocumentPayload } from "../../lib/accounting-document-payload.js";
import { documentTotals } from "../../lib/accounting-document-payload.js";
import { rowToStored } from "../../lib/accounting-document-row.js";

export class DrizzleAccountingDocumentRegistry implements IAccountingDocumentRegistry {
  constructor(
    private readonly db: Database,
    private readonly clock: AccountingClock,
  ) {}

  async register(input: RegisterInput): Promise<Result<RegisterOutcome, RegisterCode>> {
    const { document, sourceEventRef, park } = input;
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
        const fits = await creditFitsInvoice(tx, document, target);
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
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Never more credit than the invoice charged, whoever registers at the same time. The invoice's
 * credit notes in the same books are serialised by a transaction lock on (invoice, target), so
 * two registrations can never both read the old total; the new credit note must fit in the
 * invoice's gross less every other credit note registered for it there (any state but cancelled:
 * a failed one may still be tried again). The invoice must be registered there, and not only
 * cancelled. A replay of this credit note is not counted against itself.
 */
async function creditFitsInvoice(
  tx: Tx,
  note: CreditNote,
  target: DocumentTarget | null,
): Promise<Result<true, RegisterCode>> {
  const entity = legalEntityFor(note.product);
  const sameBooks = and(
    eq(accountingDocument.product, note.product),
    eq(accountingDocument.legalEntity, entity),
    sql`${accountingDocument.targetProvider} is not distinct from ${target?.provider ?? null}`,
    sql`${accountingDocument.targetMode} is not distinct from ${target?.mode ?? null}`,
  );
  const lockKey = `accounting_credit:${note.product}:${entity}:${note.invoiceReference}:${target?.provider ?? "-"}:${target?.mode ?? "-"}`;
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
  if (already + note.totals.grossPence > invoice.grossPence) {
    return refuse(
      "credit_exceeds_invoice",
      `${already}p already credited; ${note.totals.grossPence}p more exceeds the invoice's ${invoice.grossPence}p`,
    );
  }
  return ok(true);
}
