import { type TargetMode, booksTargetMode } from "@auction/accounting-domain";
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
}

/**
 * Checks the Books document queue for what a person should know about: a document that has
 * waited for a person for more than one working day, and documents the sender should have taken
 * long ago (it has stopped, or is failing before it claims). Runs as a cron; each run raises at
 * most one alert of each kind, with the count and the oldest time.
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
    return { needsPersonOverdue, senderMissed };
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
