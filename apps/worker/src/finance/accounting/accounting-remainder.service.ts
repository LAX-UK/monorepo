import {
  type PaymentRemainderPort,
  type TargetMode,
  booksTargetMode,
  planRemainder,
} from "@auction/accounting-domain";
import type {
  IAccountingRemainders,
  IAccountingSourceSettingReader,
  RemainderDue,
  RemainderRecord,
} from "@auction/persistence/interfaces";

const DEFAULT_BATCH = 10;

export interface AccountingRemainderLog {
  info(details: Record<string, unknown>, message: string): void;
  warn(details: Record<string, unknown>, message: string): void;
}

export interface AccountingRemainderDeps {
  readonly remainders: IAccountingRemainders;
  readonly settings: IAccountingSourceSettingReader;
  /** The remainder port of each mode the sender serves (the same adapters it sends through). */
  readonly portsByMode: Readonly<Partial<Record<TargetMode, PaymentRemainderPort>>>;
  readonly log: AccountingRemainderLog;
  readonly batch?: number;
}

export interface RemainderTick {
  readonly applied: number;
  readonly refused: number;
}

/**
 * After the sender: once a Shop outside-UK delivery invoice is issued (released after the
 * accountant's answer), the order payment's unapplied rest is applied to it, in the same books.
 *
 * - The pair is checked from the stored documents first (`planRemainder`): the same buyer and
 *   books, the invoice not already one the payment applies to, and its gross within what the
 *   payment left unapplied. A refusal is recorded for a person; nothing is asked of the books.
 * - The step runs while this worker holds the invoice, and is recorded in the invoice's history
 *   (`apply_remainder`) in the same transaction, so it is settled once, whatever runs.
 * - The adapter reads the payment first, so a step whose answer was lost is `already_applied`
 *   the next time, never a second application. An answer it cannot read records nothing: the next
 *   run looks again.
 * - In dry run it is rehearsed (nothing is held, nothing applied), and recorded as a rehearsal.
 */
export class AccountingRemainder {
  private readonly batch: number;

  constructor(private readonly deps: AccountingRemainderDeps) {
    this.batch = deps.batch ?? DEFAULT_BATCH;
  }

  async tick(): Promise<RemainderTick> {
    const modes = await this.activeModes();
    if (modes.length === 0) return { applied: 0, refused: 0 };
    const { due, unreadable } = await this.deps.remainders.listDue(modes, this.batch);
    for (const id of unreadable) {
      this.deps.log.warn({ documentId: id }, "accounting_remainder_unreadable");
    }
    let applied = 0;
    let refused = 0;
    for (const pair of due) {
      const outcome = await this.settle(pair);
      if (outcome === "applied") applied += 1;
      if (outcome === "rejected") refused += 1;
    }
    return { applied, refused };
  }

  /** The modes the Shop is aimed at now that this worker has adapters for. */
  private async activeModes(): Promise<TargetMode[]> {
    const config = await this.deps.settings.read();
    if (!config.ok) return [];
    const mode = booksTargetMode(config.value.shop);
    return mode !== null && this.deps.portsByMode[mode] ? [mode] : [];
  }

  private async settle(pair: RemainderDue): Promise<RemainderRecord["outcome"] | null> {
    const { invoice, payment } = pair;
    const mode = invoice.target?.mode;
    const port = mode ? this.deps.portsByMode[mode] : undefined;
    if (!port) return null;
    const plan = planRemainder(payment.document, invoice.document);
    let settled: RemainderRecord | null = null;
    const ran = await this.deps.remainders.settleExclusively(invoice.id, async () => {
      if (!plan.ok) {
        settled = {
          outcome: "rejected",
          paymentReference: payment.reference,
          amountPence: invoice.totals.grossPence,
          rehearsal: mode === "dry_run",
          reason: `accounting_remainder_${plan.refusal.code}`,
        };
        return settled;
      }
      const outcome = await port.applyRemainder(plan.value);
      if (outcome.status === "unknown") {
        this.deps.log.warn(
          { documentId: invoice.id, mode, detail: outcome.detail ?? null },
          "accounting_remainder_unknown",
        );
        return null;
      }
      settled = {
        outcome: outcome.status,
        paymentReference: plan.value.paymentReference,
        amountPence: plan.value.amountPence,
        rehearsal: outcome.status === "rejected" ? mode === "dry_run" : outcome.rehearsal,
        ...(outcome.status === "rejected" ? { reason: outcome.reason } : {}),
      };
      return settled;
    });
    if (!ran || settled === null) return null;
    const record: RemainderRecord = settled;
    if (record.outcome === "rejected") {
      // Left for a person: apply it by hand in Books (see the runbook); the history says why.
      this.deps.log.warn(
        { documentId: invoice.id, mode, reason: record.reason ?? null },
        "accounting_remainder_refused",
      );
    } else {
      this.deps.log.info(
        { documentId: invoice.id, mode, outcome: record.outcome, rehearsal: record.rehearsal },
        "accounting_remainder_applied",
      );
    }
    return record.outcome === "already_applied" ? "applied" : record.outcome;
  }
}
