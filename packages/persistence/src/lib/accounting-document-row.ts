import {
  type DocumentRecord,
  type DocumentTarget,
  type Result,
  type Totals,
  ok,
  parseRecord,
  refuse,
} from "@auction/accounting-domain";
import { toDate } from "@auction/datetime";
import type { accountingDocument } from "@auction/db/schema";
import type { StoredAccountingDocument } from "../interfaces/accounting.js";
import { readDocumentPayload } from "./accounting-document-payload.js";

export type AccountingDocumentRow = typeof accountingDocument.$inferSelect;
type LifecycleColumns = Partial<Pick<typeof accountingDocument.$inferInsert, "lastErrorClass">> &
  Pick<
    typeof accountingDocument.$inferInsert,
    | "state"
    | "attempts"
    | "leaseToken"
    | "leaseExpiresAt"
    | "settlesAt"
    | "reviewLookup"
    | "needsReviewReason"
    | "providerId"
    | "providerNumber"
    | "pdfRef"
    | "mismatchField"
    | "mismatchDifferencePence"
  >;

/** The domain speaks epoch milliseconds; the table holds timestamps. */
export function instant(epochMs: number): Date {
  const date = toDate(epochMs);
  if (date === null) throw new RangeError(`not an instant: ${epochMs}`);
  return date;
}

/** Every life-cycle column for a record, the ones it does not use set to null. */
export function lifecycleColumns(record: DocumentRecord): LifecycleColumns {
  const columns: LifecycleColumns = {
    state: record.status,
    attempts: record.attempts,
    leaseToken: null,
    leaseExpiresAt: null,
    settlesAt: null,
    reviewLookup: null,
    needsReviewReason: null,
    providerId: null,
    providerNumber: null,
    pdfRef: null,
    mismatchField: null,
    mismatchDifferencePence: null,
  };
  switch (record.status) {
    case "pending":
    case "cancelled":
      return columns;
    case "sending":
      return {
        ...columns,
        leaseToken: record.lease.token,
        leaseExpiresAt: instant(record.lease.expiresAtMs),
      };
    case "issued":
      return {
        ...columns,
        providerId: record.issued.providerId,
        providerNumber: record.issued.number,
        pdfRef: record.issued.pdfRef,
      };
    case "unknown":
      return { ...columns, settlesAt: instant(record.settlesAtMs) };
    case "failed":
      return { ...columns, lastErrorClass: record.reason };
    case "needs_review":
      if (record.lookup === "owed") {
        return {
          ...columns,
          reviewLookup: "owed",
          needsReviewReason: record.reason,
          settlesAt: instant(record.settlesAtMs),
        };
      }
      return {
        ...columns,
        reviewLookup: "clear",
        needsReviewReason: record.reason,
        providerId: record.issued?.providerId ?? null,
        providerNumber: record.issued?.number ?? null,
        pdfRef: record.issued?.pdfRef ?? null,
        mismatchField: record.mismatch?.field ?? null,
        mismatchDifferencePence: record.mismatch?.differencePence ?? null,
      };
  }
}

/** The shape `parseRecord` reads: the stored row spelled the way the domain spells a record. */
function recordInput(row: AccountingDocumentRow): Record<string, unknown> {
  const issued =
    row.providerId === null || row.providerNumber === null
      ? null
      : { number: row.providerNumber, providerId: row.providerId, pdfRef: row.pdfRef };
  return {
    kind: row.kind,
    reference: row.laxReference,
    attempts: row.attempts,
    status: row.state,
    lease:
      row.leaseToken === null || row.leaseExpiresAt === null
        ? null
        : { token: row.leaseToken, expiresAtMs: row.leaseExpiresAt.getTime() },
    issued,
    settlesAtMs: row.settlesAt?.getTime() ?? null,
    reason: row.state === "failed" ? row.lastErrorClass : row.needsReviewReason,
    lookup: row.reviewLookup,
    mismatch:
      row.mismatchField === null
        ? null
        : { field: row.mismatchField, differencePence: row.mismatchDifferencePence },
  };
}

export function rowToRecord(
  row: AccountingDocumentRow,
  nowMs: number,
): Result<DocumentRecord, "bad_record"> {
  return parseRecord(recordInput(row), nowMs);
}

export function rowTotals(row: AccountingDocumentRow): Totals {
  return { netPence: row.netPence, vatPence: row.vatPence, grossPence: row.grossPence };
}

/** The recorded target; a half-set pair (the CHECK refuses it) is read as no target, so never handed out. */
export function rowTarget(row: AccountingDocumentRow): DocumentTarget | null {
  return row.targetProvider === null || row.targetMode === null
    ? null
    : { provider: row.targetProvider, mode: row.targetMode };
}

/** A row read back through the domain's rules; a row the domain would not accept is refused. */
export function rowToStored(
  row: AccountingDocumentRow,
  nowMs: number,
): Result<StoredAccountingDocument, "bad_stored_document"> {
  const bad = (why: string) => refuse("bad_stored_document", why);
  const record = rowToRecord(row, nowMs);
  if (!record.ok) return bad(record.refusal.message);
  const document = readDocumentPayload(row.payload, {
    product: row.product,
    kind: row.kind,
    reference: row.laxReference,
  });
  if (!document.ok) return bad(document.refusal.message);
  return ok({
    id: row.id,
    product: row.product,
    legalEntity: row.legalEntity,
    kind: row.kind,
    reference: row.laxReference,
    sourceEventRef: row.sourceEventRef,
    document: document.value,
    totals: rowTotals(row),
    provider: row.provider,
    target: rowTarget(row),
    record: record.value,
    lastErrorClass: row.lastErrorClass,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
