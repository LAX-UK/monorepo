import {
  type BooksPaymentSeen,
  DEFAULT_STATUS_CHECK_ALLOWANCE,
  type DocumentStatusPort,
  type LegalEntity,
  type StatusCheckAllowance,
  type StatusCheckedKind,
  type TargetMode,
  booksPaymentTaskReference,
  decideBooksStatus,
} from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import type { UnappliedMoney } from "@auction/domain";
import type {
  BooksStatusDue,
  BooksStatusRunOutcome,
  IAccountingBooksStatusStore,
} from "@auction/persistence/interfaces";
import type { ZohoBooksNoticeModule } from "@auction/queues";

/** How long after a read a document is due again: a little under a day, so each night reads it. */
export const STATUS_READ_AGAIN_AFTER_MS = 20 * 60 * 60_000;

/** Books ids are unique in an organisation: a notice names one document, a few at the very most. */
const NOTICE_READS_AT_MOST = 3;

/** Which document kind each Books module a notice names is. */
const KIND_OF_MODULE: Readonly<Record<ZohoBooksNoticeModule, StatusCheckedKind>> = {
  invoice: "invoice",
  creditnote: "credit_note",
  customerpayment: "payment",
};

/**
 * Where a payment recorded in Books by hand goes: a finance task (and its alert), opened in the
 * same transaction as the read that found it. Never anything that applies money.
 */
export interface FinanceTaskOpener {
  open(tx: Database, money: UnappliedMoney): Promise<void>;
}

export interface StatusCheckLog {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
}

export interface AccountingStatusCheckDeps {
  readonly store: IAccountingBooksStatusStore;
  /** The status reader of each mode the sender serves; the dry run's reads nothing. */
  readonly statusesByMode: Readonly<Partial<Record<TargetMode, DocumentStatusPort>>>;
  /** The Books organisation of each legal entity, for the finance task's key. */
  readonly organisationIds: Readonly<Partial<Record<LegalEntity, string>>>;
  readonly tasks: FinanceTaskOpener;
  readonly transactions: { runInTransaction<T>(fn: (tx: Database) => Promise<T>): Promise<T> };
  readonly log: StatusCheckLog;
  readonly now: () => Date;
  /** The check's share of the day's Books calls (the live client counts against it too). */
  readonly allowance?: StatusCheckAllowance;
}

type CheckOutcome =
  | { readonly kind: "recorded"; readonly changed: boolean; readonly tasks: number }
  | { readonly kind: "rehearsal" | "budget_spent" | "unavailable" | "skipped" };

export interface StatusCheckResult {
  readonly outcome: BooksStatusRunOutcome;
  readonly checked: number;
  readonly changed: number;
  readonly tasks: number;
}

/**
 * The nightly Books status check. For each issued Books document due a read it asks Books what
 * the document is now (one read, within the check's share of the day's budget), records what
 * changed, and opens a finance task for each payment Books shows that LAX did not send. It never
 * marks an invoice, a payment or a lot paid, and holds nothing that could: Books is not trusted to
 * move money in LAX. A Books notice only moves a document to the front (`recheckFromNotice`).
 */
export class AccountingStatusCheck {
  private readonly allowance: StatusCheckAllowance;

  constructor(private readonly deps: AccountingStatusCheckDeps) {
    this.allowance = deps.allowance ?? DEFAULT_STATUS_CHECK_ALLOWANCE;
  }

  /** One nightly run, recorded as a run so a missed night can be told. */
  async runNightly(): Promise<StatusCheckResult> {
    const startedAt = this.deps.now();
    const runId = await this.deps.store.startRun(startedAt);
    let checked = 0;
    let changed = 0;
    let tasks = 0;
    let rehearsed = 0;
    let outcome: BooksStatusRunOutcome = "completed";
    try {
      const modes = Object.keys(this.deps.statusesByMode) as TargetMode[];
      const due = await this.deps.store.listDue(
        modes,
        new Date(startedAt.getTime() - STATUS_READ_AGAIN_AFTER_MS),
        // One read per document, never more than the share allows; one more is listed to tell
        // that some were left for tomorrow.
        this.allowance.maxCalls + 1,
      );
      if (due.unreadable.length > 0) {
        this.deps.log.warn({ documentIds: due.unreadable }, "accounting_status_unreadable");
      }
      let reads = 0;
      for (const item of due.documents) {
        if (reads >= this.allowance.maxCalls) {
          outcome = "budget_spent";
          break;
        }
        const result = await this.check(item);
        if (result.kind === "skipped") continue;
        reads += 1;
        if (result.kind === "budget_spent") {
          outcome = "budget_spent";
          break;
        }
        if (result.kind === "rehearsal") rehearsed += 1;
        if (result.kind === "recorded") {
          checked += 1;
          if (result.changed) changed += 1;
          tasks += result.tasks;
        }
      }
      if (outcome === "completed" && checked === 0 && rehearsed > 0) outcome = "rehearsal";
    } catch (error) {
      await this.deps.store.finishRun(
        runId,
        "failed",
        { checked, changed, tasks },
        this.deps.now(),
      );
      throw error;
    }
    await this.deps.store.finishRun(runId, outcome, { checked, changed, tasks }, this.deps.now());
    this.deps.log.info({ outcome, checked, changed, tasks }, "accounting_status_check_finished");
    return { outcome, checked, changed, tasks };
  }

  /**
   * A signed Books notice named a document: it is only a hint. The document is marked to be read
   * first and read now, from Books; nothing the notice said is used. A notice for books or a
   * document LAX does not hold changes nothing.
   */
  async recheckFromNotice(notice: {
    readonly organizationId: string;
    readonly module: ZohoBooksNoticeModule;
    readonly entityId: string;
  }): Promise<"read" | "not_ours" | "not_read"> {
    const entity = (Object.entries(this.deps.organisationIds) as [LegalEntity, string][]).find(
      ([, id]) => id === notice.organizationId,
    )?.[0];
    const kind = KIND_OF_MODULE[notice.module];
    if (!entity || !kind) return "not_ours";
    const documentIds = await this.deps.store.requestRecheck(
      entity,
      kind,
      notice.entityId,
      this.deps.now(),
      NOTICE_READS_AT_MOST,
    );
    let read = false;
    let held = false;
    for (const documentId of documentIds) {
      const due = await this.deps.store.findDue(documentId);
      if (!due) continue;
      held = true;
      // Not read now (no budget, Books unclear, a rehearsal): the mark stays, and tonight's run
      // reads it first.
      if ((await this.check(due)).kind === "recorded") read = true;
    }
    if (!held) return "not_ours";
    return read ? "read" : "not_read";
  }

  private async check(item: BooksStatusDue): Promise<CheckOutcome> {
    const { stored, previous } = item;
    const port = stored.target ? this.deps.statusesByMode[stored.target.mode] : undefined;
    if (!port || !stored.target || stored.record.status !== "issued") return { kind: "skipped" };
    const read = await port.readStatus(stored.document, stored.record.issued);
    if (read.status === "rehearsal" || read.status === "budget_spent") return { kind: read.status };
    if (read.status === "unavailable") {
      this.deps.log.warn(
        { documentId: stored.id, reason: read.reason },
        "accounting_status_unavailable",
      );
      return { kind: "unavailable" };
    }
    const seen =
      read.status === "read" ? read.reading.payments.map((p) => p.providerPaymentId) : [];
    const laxPaymentIds = await this.deps.store.knownPaymentIds(
      stored.legalEntity,
      stored.target,
      seen,
    );
    const decision = decideBooksStatus({ previous, read, laxPaymentIds });
    const observedAt = this.deps.now();
    await this.deps.transactions.runInTransaction(async (tx) => {
      await this.deps.store.record(tx, stored.id, decision, observedAt);
      for (const payment of decision.financeTasks) {
        await this.deps.tasks.open(tx, this.taskFor(stored.legalEntity, stored.reference, payment));
      }
    });
    for (const change of decision.changes) {
      this.deps.log.info(
        {
          documentId: stored.id,
          reference: stored.reference,
          change: change.kind,
          ...(change.kind === "state_changed"
            ? { from: change.from, to: change.to }
            : { booksPaymentId: change.payment.providerPaymentId }),
        },
        "accounting_status_changed",
      );
    }
    return {
      kind: "recorded",
      changed: decision.changes.length > 0,
      tasks: decision.financeTasks.length,
    };
  }

  private taskFor(
    entity: LegalEntity,
    reference: string,
    payment: BooksPaymentSeen,
  ): UnappliedMoney {
    const organisation = this.deps.organisationIds[entity] ?? entity;
    return {
      reason: "books_payment_recorded_by_hand",
      paymentId: null,
      paymentGroupId: null,
      stripePaymentIntentId: null,
      stripeChargeId: null,
      stripeCustomerId: null,
      booksPaymentKey: booksPaymentTaskReference(organisation, payment.providerPaymentId),
      accountingReference: reference,
      booksPaymentMode: payment.mode,
      booksPaymentDate: payment.date,
      amountCents: payment.amountPence,
      currency: "GBP",
    };
  }
}
