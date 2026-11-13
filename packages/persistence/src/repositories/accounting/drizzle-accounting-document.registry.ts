import { isDeepStrictEqual } from "node:util";
import {
  type Result,
  documentTarget,
  legalEntityFor,
  ok,
  refuse,
} from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import {
  accountingDocument,
  accountingDocumentEvent,
  accountingSourceSetting,
} from "@auction/db/schema";
import { and, eq, sql } from "drizzle-orm";
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
    const { document, sourceEventRef } = input;
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
          toState: "pending",
          attempts: 0,
          detail: { sourceEventRef, target },
          occurredAt: at,
        });
        const stored = rowToStored(inserted, at.getTime());
        return stored.ok
          ? ok({ created: true, stored: stored.value })
          : refuse("bad_document", stored.refusal.message);
      }
      // The reference is taken for this target. The same document again is a replay; a different
      // one is a bug.
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
