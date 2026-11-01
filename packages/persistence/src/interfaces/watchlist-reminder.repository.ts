import type { WatchedLotReminderKind } from "@auction/domain";

/** A person's reminder on one watched lot. */
export type WatchlistReminderRow = {
  lotId: string;
  kind: WatchedLotReminderKind;
  note: string | null;
  sentAt: Date | null;
  updatedAt: Date;
};

/** A reminder not sent yet, with the lot's times, for the job that sends reminders. */
export type PendingWatchlistReminder = {
  watchlistId: string;
  userId: string;
  lotId: string;
  kind: WatchedLotReminderKind;
  note: string | null;
  lotTitle: string;
  startTime: Date;
  endTime: Date;
  /** The lot finished (ended, cancelled or voided). */
  closed: boolean;
};

export interface IWatchlistReminderRepository {
  /** The person's reminders, one per watched lot that has one. */
  listForUser(userId: string): Promise<WatchlistReminderRow[]>;
  /**
   * Sets (or replaces) the reminder on a lot the person watches, ready to send again; `null`
   * when they don't watch it.
   */
  set(
    userId: string,
    lotId: string,
    reminder: { kind: WatchedLotReminderKind; note: string | null },
  ): Promise<WatchlistReminderRow | null>;
  /** Removes the reminder; watching the lot is unchanged. */
  clear(userId: string, lotId: string): Promise<void>;
  /**
   * Reminders not sent yet that are due by `now` (from the lot's current times), plus those on
   * lots that have closed, soonest closing first.
   */
  listPending(now: Date, limit: number): Promise<PendingWatchlistReminder[]>;
  /** Marks one sent (or dropped); `false` when another run already did. */
  markSent(watchlistId: string, at: Date): Promise<boolean>;
}
