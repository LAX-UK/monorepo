import {
  WATCHED_LOT_REMINDER_NOTIFICATION,
  watchedLotReminderNotice,
  watchedLotReminderStep,
} from "@auction/domain";
import type { IWatchlistReminderRepository } from "@auction/persistence/interfaces";
import type { NotificationDispatcher } from "../notification.dispatcher.js";

/** Reminders looked at per run; the job runs every few minutes, so a backlog clears quickly. */
export const WATCHED_LOT_REMINDER_BATCH = 500;

export type WatchedLotReminderRun = { sent: number; dropped: number };

/** Sends the watched-lot reminders that are due. */
export interface IWatchedLotReminderJob {
  sendDue(now?: Date): Promise<WatchedLotReminderRun>;
}

/**
 * Sends each due reminder once, through the notification dispatcher, so the person's mutes,
 * quiet hours and watchlist switches apply. A reminder is claimed before it is sent, so two runs
 * never send it twice; one whose moment passed is dropped rather than sent late. Reminders are
 * about the person's own list, so they belong to their personal account.
 */
export class WatchedLotReminderJob implements IWatchedLotReminderJob {
  constructor(
    private readonly deps: {
      reminders: Pick<IWatchlistReminderRepository, "listPending" | "markSent">;
      dispatcher: Pick<NotificationDispatcher, "dispatch">;
    },
  ) {}

  async sendDue(now: Date = new Date()): Promise<WatchedLotReminderRun> {
    const pending = await this.deps.reminders.listPending(now, WATCHED_LOT_REMINDER_BATCH);
    const run: WatchedLotReminderRun = { sent: 0, dropped: 0 };
    for (const reminder of pending) {
      const step = watchedLotReminderStep(reminder.kind, reminder, now);
      if (step === "wait") continue;
      if (!(await this.deps.reminders.markSent(reminder.watchlistId, now))) continue;
      if (step === "expire") {
        run.dropped += 1;
        continue;
      }
      const notice = watchedLotReminderNotice({
        kind: reminder.kind,
        lotTitle: reminder.lotTitle,
        note: reminder.note,
      });
      await this.deps.dispatcher.dispatch(reminder.userId, {
        type: WATCHED_LOT_REMINDER_NOTIFICATION[reminder.kind],
        title: notice.title,
        message: notice.message,
        lotId: reminder.lotId,
        legalEntityId: null,
        meta: {
          lotTitle: reminder.lotTitle,
          outboxIdempotencyKey: `watched-lot-reminder:${reminder.watchlistId}:${reminder.kind}`,
        },
      });
      run.sent += 1;
    }
    return run;
  }
}
