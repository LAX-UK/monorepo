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
import { ACCOUNTING_ALERTS, type AccountingAlertSink } from "./accounting-alerts.js";

const DEFAULT_BATCH = 10;

/** The products that give money back through a credit note (plan v2: Bid flows 8 and 9, Shop flow 21). */
const PRODUCTS: readonly Product[] = ["bid", "shop"];

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
  /** Where a refused refund is reported (`accounting_credit_note_refund_refused`). */
  readonly alerts?: AccountingAlertSink;
  readonly batch?: number;
}

export interface CreditNoteRefundTick {
  readonly refunded: number;
  readonly refused: number;
  /** Credit notes whose refund was found taken back: held for a person, never refunded. */
  readonly held: number;
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
 * - Before the step, the refund itself is read again under the credit note's lock: one taken back
 *   since (a reversal that met the note while it was being sent, say, and ran out of tries) is
 *   held for a person (`accounting_refund_reversed_after_credit`) with an alert, never refunded.
 * - A refund Books refuses is not settled for anyone: the credit note is held for a person in the
 *   same transaction ("Needs a person", `accounting_credit_note_refund_refused`) and an alert is
 *   raised. A person refunds it by hand in Books (see the runbook).
 */
export class AccountingCreditNoteRefund {
  private readonly batch: number;

  constructor(private readonly deps: AccountingCreditNoteRefundDeps) {
    this.batch = deps.batch ?? DEFAULT_BATCH;
  }

  async tick(): Promise<CreditNoteRefundTick> {
    const modes = await this.activeModes();
    if (modes.length === 0) return { refunded: 0, refused: 0, held: 0 };
    const { due, unreadable } = await this.deps.refunds.listDue(modes, this.batch);
    for (const id of unreadable) {
      this.deps.log.warn({ documentId: id }, "accounting_credit_note_refund_unreadable");
    }
    let refunded = 0;
    let refused = 0;
    let held = 0;
    for (const item of due) {
      const outcome = await this.settle(item);
      if (outcome === "refunded") refunded += 1;
      if (outcome === "rejected") refused += 1;
      if (outcome === "held") held += 1;
    }
    return { refunded, refused, held };
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
  ): Promise<CreditNoteRefundRecord["outcome"] | "held" | null> {
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
    if (ran === "refund_reversed") {
      const details = {
        documentId: creditNote.id,
        reference: creditNote.reference,
        mode,
        providerNumber:
          creditNote.record.status === "issued" ? creditNote.record.issued.number : null,
        sourceEvent: "credit_note_refund_recheck",
      };
      if (this.deps.alerts) {
        this.deps.alerts.raise(ACCOUNTING_ALERTS.refundReversedAfterCredit, details);
      } else {
        this.deps.log.warn(details, "accounting_refund_reversed_after_credit");
      }
      return "held";
    }
    if (ran !== "settled" || settled === null) return null;
    const record: CreditNoteRefundRecord = settled;
    if (record.outcome === "rejected") {
      // Held for a person in the same transaction: refund it by hand in Books (see the runbook).
      const details = {
        documentId: creditNote.id,
        reference: creditNote.reference,
        mode,
        reason: record.reason ?? null,
      };
      if (this.deps.alerts) {
        this.deps.alerts.raise(ACCOUNTING_ALERTS.creditNoteRefundRefused, details);
      } else {
        this.deps.log.warn(details, "accounting_credit_note_refund_refused");
      }
    } else {
      this.deps.log.info(
        { documentId: creditNote.id, mode, outcome: record.outcome, rehearsal: record.rehearsal },
        "accounting_credit_note_refunded",
      );
    }
    return record.outcome === "already_refunded" ? "refunded" : record.outcome;
  }
}
