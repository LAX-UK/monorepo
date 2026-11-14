import {
  INVOICE_DELAYED_AFTER_MS,
  type TargetMode,
  booksTargetMode,
} from "@auction/accounting-domain";
import {
  LONDON_WORKING_CALENDAR,
  type WorkingCalendar,
  workingMinutesBetween,
} from "@auction/domain";
import type {
  IAccountingAttentionReader,
  IAccountingSourceSettingReader,
} from "@auction/persistence/interfaces";
import { ACCOUNTING_ALERTS, type AccountingAlertSink } from "./accounting-alerts.js";

/** One working day, 09:00 to 18:00 London, in minutes. */
export const WORKING_DAY_MINUTES = 9 * 60;

/**
 * How long a queued document may wait unclaimed before the sender counts as stopped. The sender
 * runs every couple of seconds with the projectors; a quarter of an hour is far past any backlog.
 */
export const SENDER_MISSED_AFTER_MS = 15 * 60_000;

/**
 * How long a payment may wait for its invoice before someone is told. It waits without using an
 * attempt, so a refused or held invoice would otherwise hold it silently.
 */
export const PAYMENT_WAITING_AFTER_MS = 6 * 60 * 60_000;

/**
 * How long an issued Shop outside-UK delivery invoice may wait for the order payment's rest to be
 * applied to it. The step runs after every send; hours mean Books' answer keeps failing or the
 * payment is refused.
 */
export const REMAINDER_UNSETTLED_AFTER_MS = 6 * 60 * 60_000;

export interface AccountingWatchDeps {
  readonly attention: IAccountingAttentionReader;
  readonly settings: IAccountingSourceSettingReader;
  /** The modes the sender serves (its adapters); a document aimed elsewhere is not its to send. */
  readonly senderModes: readonly TargetMode[];
  readonly alerts: AccountingAlertSink;
  readonly now: () => Date;
  readonly calendar?: WorkingCalendar;
}

export interface WatchResult {
  readonly needsPersonOverdue: boolean;
  readonly senderMissed: boolean;
  readonly bidInvoiceDelayed: boolean;
  readonly paymentWaiting: boolean;
  readonly remainderDelayed: boolean;
  readonly creditNoteRefundDelayed: boolean;
}

/**
 * Checks the Books document queue for what a person should know about: a document that has
 * waited for a person for more than one working day, documents the sender should have taken
 * long ago (it has stopped, or is failing before it claims), buyers' Bid invoices still being
 * prepared after 30 minutes, payments still waiting for their invoice after six hours, and Shop
 * delivery invoices issued six hours ago whose payment's rest is not applied yet, and refunds'
 * credit notes issued six hours ago whose money is not refunded in Books yet. Runs as a cron; each run raises at most one alert of each kind, with
 * the count and the oldest time.
 */
export class AccountingWatch {
  constructor(private readonly deps: AccountingWatchDeps) {}

  async check(): Promise<WatchResult> {
    const now = this.deps.now();
    const modes = await this.activeModes();
    const attention = await this.deps.attention.read(modes);
    const calendar = this.deps.calendar ?? LONDON_WORKING_CALENDAR;

    const oldestPerson = attention.needsPerson.oldestSince;
    const needsPersonOverdue =
      oldestPerson !== null &&
      workingMinutesBetween(calendar, oldestPerson, now) > WORKING_DAY_MINUTES;
    if (needsPersonOverdue) {
      this.deps.alerts.raise(ACCOUNTING_ALERTS.needsPersonOverdue, {
        count: attention.needsPerson.count,
        oldestSince: oldestPerson.toISOString(),
        page: "/admin/finance/accounting",
      });
    }

    const oldestPending = attention.pending.oldestSince;
    const senderMissed =
      oldestPending !== null && now.getTime() - oldestPending.getTime() > SENDER_MISSED_AFTER_MS;
    if (senderMissed) {
      this.deps.alerts.raise(ACCOUNTING_ALERTS.senderMissed, {
        count: attention.pending.count,
        oldestSince: oldestPending.toISOString(),
        modes,
      });
    }
    // The buyer's card turns to "taking longer than usual" at the same point, and says we know.
    const delayed = await this.deps.attention.delayedBidInvoices(
      modes,
      new Date(now.getTime() - INVOICE_DELAYED_AFTER_MS),
    );
    const bidInvoiceDelayed = delayed.count > 0 && delayed.oldestSince !== null;
    if (bidInvoiceDelayed) {
      this.deps.alerts.raise(ACCOUNTING_ALERTS.bidInvoiceDelayed, {
        count: delayed.count,
        oldestSince: delayed.oldestSince?.toISOString(),
        modes,
        page: "/admin/finance/accounting",
      });
    }
    // A payment held by its invoice for hours: the same delayed-accounting alert, for payments.
    const waiting = await this.deps.attention.waitingPayments(
      modes,
      new Date(now.getTime() - PAYMENT_WAITING_AFTER_MS),
    );
    const paymentWaiting = waiting.count > 0 && waiting.oldestSince !== null;
    if (paymentWaiting) {
      this.deps.alerts.raise(ACCOUNTING_ALERTS.bidInvoiceDelayed, {
        documentType: "payment",
        count: waiting.count,
        oldestSince: waiting.oldestSince?.toISOString(),
        modes,
        page: "/admin/finance/accounting?tab=waiting",
      });
    }
    // A Shop delivery invoice issued hours ago whose payment's rest is still not applied to it.
    const unsettled = await this.deps.attention.unsettledRemainders(
      modes,
      new Date(now.getTime() - REMAINDER_UNSETTLED_AFTER_MS),
    );
    const remainderDelayed = unsettled.count > 0 && unsettled.oldestSince !== null;
    if (remainderDelayed) {
      this.deps.alerts.raise(ACCOUNTING_ALERTS.shopRemainderDelayed, {
        documentType: "invoice",
        count: unsettled.count,
        oldestSince: unsettled.oldestSince?.toISOString(),
        modes,
        page: "/admin/finance/accounting",
      });
    }
    // A refund's credit note issued hours ago whose money is still not refunded in Books.
    const unrefunded = await this.deps.attention.unrefundedCreditNotes(
      modes,
      new Date(now.getTime() - REMAINDER_UNSETTLED_AFTER_MS),
    );
    const creditNoteRefundDelayed = unrefunded.count > 0 && unrefunded.oldestSince !== null;
    if (creditNoteRefundDelayed) {
      this.deps.alerts.raise(ACCOUNTING_ALERTS.creditNoteRefundDelayed, {
        documentType: "credit_note",
        count: unrefunded.count,
        oldestSince: unrefunded.oldestSince?.toISOString(),
        modes,
        page: "/admin/finance/accounting?tab=issued",
      });
    }
    return {
      needsPersonOverdue,
      senderMissed,
      bidInvoiceDelayed,
      paymentWaiting,
      remainderDelayed,
      creditNoteRefundDelayed,
    };
  }

  /**
   * The modes the sender should be sending in now: those it serves that some product aims Books
   * at. With Books off (or the switch unreadable) none, so nothing counts as missed.
   */
  private async activeModes(): Promise<TargetMode[]> {
    const config = await this.deps.settings.read();
    if (!config.ok) return [];
    const aimed = new Set(
      Object.values(config.value)
        .map((product) => booksTargetMode(product))
        .filter((mode): mode is TargetMode => mode !== null),
    );
    return this.deps.senderModes.filter((mode) => aimed.has(mode));
  }
}
