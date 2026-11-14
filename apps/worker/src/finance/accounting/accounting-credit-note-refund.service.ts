import {
  type CreditNoteRefundPort,
  type Product,
  type TargetMode,
  booksTargetMode,
  planCreditNoteRefund,
} from "@auction/accounting-domain";
import type {
  CreditNoteRefundDue,
  CreditNoteRefundRecord,
  IAccountingCreditNoteRefunds,
  IAccountingSourceSettingReader,
} from "@auction/persistence/interfaces";

const DEFAULT_BATCH = 10;

/** Only Bid gives money back through a credit note today (plan v2, flows 8 and 9). */
const PRODUCTS: readonly Product[] = ["bid"];

export interface AccountingCreditNoteRefundLog {
  info(details: Record<string, unknown>, message: string): void;
  warn(details: Record<string, unknown>, message: string): void;
}

export interface AccountingCreditNoteRefundDeps {
  readonly refunds: IAccountingCreditNoteRefunds;
  readonly settings: IAccountingSourceSettingReader;
  /** The refund port of each mode the sender serves (the same adapters it sends through). */
  readonly portsByMode: Readonly<Partial<Record<TargetMode, CreditNoteRefundPort>>>;
  readonly log: AccountingCreditNoteRefundLog;
  readonly batch?: number;
}

export interface CreditNoteRefundTick {
  readonly refunded: number;
  readonly refused: number;
}

/**
 * After the sender: a credit note for a refund that went through, once issued, has its money
 * refunded in the same books from the Stripe clearing account, once.
 *
 * - The refund is planned from the stored credit note alone (`planCreditNoteRefund`): its whole
 *   gross, from Stripe clearing. A credit note that gives no money back is never listed.
 * - The step runs while this worker holds the credit note and is recorded in its history
 *   (`refund_credit_note`) in the same transaction, so it is settled once, whatever runs.
 * - The adapter reads the credit note's refunds first, so a step whose answer was lost is
 *   `already_refunded` the next time, never a second refund. An answer it cannot read records
 *   nothing: the next run looks again, after the credit notes not tried yet.
 * - In dry run it is rehearsed (nothing is held, nothing refunded), and recorded as a rehearsal.
 */
export class AccountingCreditNoteRefund {
  private readonly batch: number;

  constructor(private readonly deps: AccountingCreditNoteRefundDeps) {
    this.batch = deps.batch ?? DEFAULT_BATCH;
  }

  async tick(): Promise<CreditNoteRefundTick> {
    const modes = await this.activeModes();
    if (modes.length === 0) return { refunded: 0, refused: 0 };
    const { due, unreadable } = await this.deps.refunds.listDue(modes, this.batch);
    for (const id of unreadable) {
      this.deps.log.warn({ documentId: id }, "accounting_credit_note_refund_unreadable");
    }
    let refunded = 0;
    let refused = 0;
    for (const item of due) {
      const outcome = await this.settle(item);
      if (outcome === "refunded") refunded += 1;
      if (outcome === "rejected") refused += 1;
    }
    return { refunded, refused };
  }

  /** The modes the products that refund are aimed at now, that this worker has adapters for. */
  private async activeModes(): Promise<TargetMode[]> {
    const config = await this.deps.settings.read();
    if (!config.ok) return [];
    const modes = new Set<TargetMode>();
    for (const product of PRODUCTS) {
      const mode = booksTargetMode(config.value[product]);
      if (mode !== null && this.deps.portsByMode[mode]) modes.add(mode);
    }
    return [...modes];
  }

  private async settle(
    item: CreditNoteRefundDue,
  ): Promise<CreditNoteRefundRecord["outcome"] | null> {
    const { creditNote } = item;
    const mode = creditNote.target?.mode;
    const port = mode ? this.deps.portsByMode[mode] : undefined;
    if (!port) return null;
    const plan = planCreditNoteRefund(creditNote.document);
    let settled: CreditNoteRefundRecord | null = null;
    const ran = await this.deps.refunds.settleExclusively(creditNote.id, async () => {
      if (!plan.ok) {
        settled = {
          outcome: "rejected",
          amountPence: creditNote.totals.grossPence,
          account: "stripe_clearing",
          rehearsal: mode === "dry_run",
          reason: `accounting_credit_note_refund_${plan.refusal.code}`,
        };
        return settled;
      }
      const outcome = await port.refundCreditNote(plan.value);
      if (outcome.status === "unknown") {
        this.deps.log.warn(
          { documentId: creditNote.id, mode, detail: outcome.detail ?? null },
          "accounting_credit_note_refund_unknown",
        );
        return null;
      }
      settled = {
        outcome: outcome.status,
        amountPence: plan.value.amountPence,
        account: plan.value.account,
        rehearsal: outcome.status === "rejected" ? mode === "dry_run" : outcome.rehearsal,
        ...(outcome.status === "rejected" ? { reason: outcome.reason } : {}),
      };
      return settled;
    });
    if (!ran || settled === null) return null;
    const record: CreditNoteRefundRecord = settled;
    if (record.outcome === "rejected") {
      // Left for a person: refund it by hand in Books (see the runbook); the history says why.
      this.deps.log.warn(
        { documentId: creditNote.id, mode, reason: record.reason ?? null },
        "accounting_credit_note_refund_refused",
      );
    } else {
      this.deps.log.info(
        { documentId: creditNote.id, mode, outcome: record.outcome, rehearsal: record.rehearsal },
        "accounting_credit_note_refunded",
      );
    }
    return record.outcome === "already_refunded" ? "refunded" : record.outcome;
  }
}
