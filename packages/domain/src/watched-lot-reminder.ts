/**
 * A reminder on a watched lot: the person picks when (as the sale starts, a day before the lot
 * closes, or an hour before) and may add a note for themselves. The time is kept as that choice,
 * not a clock time, so a lot whose close moves (a later sale date, an extension) still reminds at
 * the right moment. Each reminder is sent once; changing it sends it again at the new time.
 */

export const WATCHED_LOT_REMINDER_KINDS = [
  "sale_start",
  "day_before_close",
  "hour_before_close",
] as const;
export type WatchedLotReminderKind = (typeof WATCHED_LOT_REMINDER_KINDS)[number];

/** The longest note a reminder keeps. */
export const WATCHED_LOT_REMINDER_NOTE_MAX = 500;

const HOUR = 60 * 60 * 1000;

/** How far before the close each closing reminder goes. */
const BEFORE_CLOSE: Record<Exclude<WatchedLotReminderKind, "sale_start">, number> = {
  day_before_close: 24 * HOUR,
  hour_before_close: HOUR,
};

export type ReminderLotTimes = { startTime: Date | null; endTime: Date | null };

/** When the reminder is due, or `null` while the lot has no such time yet. */
export function watchedLotReminderDueAt(
  kind: WatchedLotReminderKind,
  lot: ReminderLotTimes,
): Date | null {
  if (kind === "sale_start") return lot.startTime;
  return lot.endTime ? new Date(lot.endTime.getTime() - BEFORE_CLOSE[kind]) : null;
}

/**
 * - `send`: due now, and the moment it is about has not passed;
 * - `wait`: not yet due (or no time known yet);
 * - `expire`: the moment passed without it being sent (the lot closed, or the sale started more
 *   than an hour ago), so it is dropped rather than sent late.
 */
export type WatchedLotReminderStep = "send" | "wait" | "expire";

/** A sale-start reminder still makes sense this long after the start. */
const START_GRACE = HOUR;

export function watchedLotReminderStep(
  kind: WatchedLotReminderKind,
  lot: ReminderLotTimes & { closed: boolean },
  now: Date,
): WatchedLotReminderStep {
  if (lot.closed || (lot.endTime && lot.endTime.getTime() <= now.getTime())) return "expire";
  const due = watchedLotReminderDueAt(kind, lot);
  if (!due || due.getTime() > now.getTime()) return "wait";
  if (kind === "sale_start" && now.getTime() - due.getTime() > START_GRACE) return "expire";
  return "send";
}

/**
 * The notification type every reminder is sent as. It follows the person's "Lots you watch"
 * switches (app and email), since they asked for it on a lot they watch.
 */
export const WATCHED_LOT_REMINDER_NOTIFICATION = "watchlist_reminder" as const;

/** The reminder's words. */
export function watchedLotReminderNotice(input: {
  kind: WatchedLotReminderKind;
  lotTitle: string;
  note: string | null;
}): { title: string; message: string } {
  const when: Record<WatchedLotReminderKind, string> = {
    sale_start: "Bidding has opened",
    day_before_close: "It closes in about a day",
    hour_before_close: "It closes in about an hour",
  };
  const note = input.note?.trim();
  return {
    title: `Reminder: "${input.lotTitle}"`,
    message: `${when[input.kind]}.${note ? ` Your note: ${note}` : ""}`,
  };
}
