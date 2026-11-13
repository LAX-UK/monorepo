import {
  type DocumentRecord,
  type LifecycleCode,
  type Result,
  type Totals,
  applyLookup,
  cancel,
  completeSending,
  escalate,
  expireLease,
  refuse,
  requeue,
  withhold,
} from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import { accountingDocument, accountingDocumentEvent } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type {
  AccountingProvider,
  DocumentTransition,
  StoredAccountingDocument,
  TransitionCode,
} from "../interfaces/accounting.js";
import {
  type AccountingDocumentRow,
  lifecycleColumns,
  rowToRecord,
  rowToStored,
  rowTotals,
} from "./accounting-document-row.js";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Every history action: a `DocumentTransition` plus the two the queue and the registry make. A
 * withheld send is an escalation in the history (`historyAction`), with `unsent` in its detail.
 */
export type MoveAction =
  | Exclude<DocumentTransition["action"], "withhold">
  | "start_sending"
  | "created";

export function historyAction(transition: DocumentTransition): MoveAction {
  return transition.action === "withhold" ? "escalate" : transition.action;
}

/** Ask the domain what the transition does; it alone decides what is legal. */
export function decide(
  record: DocumentRecord,
  transition: DocumentTransition,
  nowMs: number,
  expected: Totals,
): Result<DocumentRecord, LifecycleCode> {
  switch (transition.action) {
    case "expire_lease":
      return expireLease(record, nowMs);
    case "complete_sending":
      return completeSending(record, transition.leaseToken, transition.outcome, nowMs, expected);
    case "apply_lookup":
      return applyLookup(record, transition.outcome, nowMs, expected);
    case "escalate":
      return escalate(record, transition.reason);
    case "withhold":
      return withhold(record, transition.leaseToken, transition.reason);
    case "requeue":
      return requeue(record);
    case "cancel":
      return cancel(record);
  }
}

/**
 * What is worth keeping about a transition's input in its history row (never the lease token).
 * When the provider reports totals (an issued, found or differing document), both its totals and
 * ours are kept, so a difference found on read-back is on record with both sides, to the penny.
 */
export function transitionDetail(
  transition: DocumentTransition,
  expected: Totals,
): Record<string, unknown> {
  switch (transition.action) {
    case "complete_sending":
    case "apply_lookup": {
      const outcome = transition.outcome;
      if (!("totals" in outcome)) return { outcome: outcome.status };
      return {
        outcome: outcome.status,
        ...(outcome.status === "differs" ? { reason: outcome.reason } : {}),
        providerTotals: outcome.totals,
        expectedTotals: expected,
      };
    }
    case "escalate":
      return { reason: transition.reason };
    case "withhold":
      return { reason: transition.reason, unsent: true };
    default:
      return {};
  }
}

export interface Move {
  readonly action: MoveAction;
  readonly next: DocumentRecord;
  readonly detail: Record<string, unknown>;
  readonly provider?: AccountingProvider;
  readonly at: Date;
}

/**
 * Write the new state and its history row inside the caller's transaction, on a row the caller has
 * locked. A move that changes nothing (a lookup that was unavailable) writes nothing.
 */
export async function persistMove(
  tx: Tx,
  row: AccountingDocumentRow,
  before: DocumentRecord,
  move: Move,
): Promise<Result<StoredAccountingDocument, TransitionCode>> {
  if (move.next === before) return rowToStored(row, move.at.getTime());
  const [updated] = await tx
    .update(accountingDocument)
    .set({
      ...lifecycleColumns(move.next),
      // A requeue keeps the last failure; only a failure sets it.
      ...(move.next.status === "failed" ? {} : { lastErrorClass: row.lastErrorClass }),
      ...(move.provider ? { provider: move.provider } : {}),
      updatedAt: move.at,
    })
    .where(eq(accountingDocument.id, row.id))
    .returning();
  if (!updated) return refuse("not_found", "document vanished while locked");
  await tx.insert(accountingDocumentEvent).values({
    documentId: row.id,
    action: move.action,
    fromState: before.status,
    toState: move.next.status,
    attempts: move.next.attempts,
    detail: move.detail,
    occurredAt: move.at,
  });
  return rowToStored(updated, move.at.getTime());
}

/** Lock one document, read it through the domain, apply a transition and persist it. */
export async function applyLockedTransition(
  tx: Tx,
  row: AccountingDocumentRow,
  transition: DocumentTransition,
  at: Date,
): Promise<Result<StoredAccountingDocument, TransitionCode>> {
  const record = rowToRecord(row, at.getTime());
  if (!record.ok) return refuse("bad_stored_document", record.refusal.message);
  const expected = rowTotals(row);
  const next = decide(record.value, transition, at.getTime(), expected);
  if (!next.ok) return next;
  return persistMove(tx, row, record.value, {
    action: historyAction(transition),
    next: next.value,
    detail: transitionDetail(transition, expected),
    at,
  });
}
