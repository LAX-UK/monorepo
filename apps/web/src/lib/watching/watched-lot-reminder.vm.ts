import { formatDateTimeShort } from "@/lib/ui/format";
import {
  WATCHED_LOT_REMINDER_KINDS,
  type WatchedLotReminderKind,
  watchedLotReminderDueAt,
} from "@auction/domain";

/** A watched lot's reminder as the row and the dialog use it. */
export type WatchedLotReminderVm = { kind: WatchedLotReminderKind; note: string | null };

const OPTION_LABEL: Record<WatchedLotReminderKind, string> = {
  sale_start: "When the sale starts",
  day_before_close: "1 day before it closes",
  hour_before_close: "1 hour before it closes",
};

/** "reminder 1 day before", for the row's meta line. */
const ROW_LABEL: Record<WatchedLotReminderKind, string> = {
  sale_start: "reminder when it opens",
  day_before_close: "reminder 1 day before",
  hour_before_close: "reminder 1 hour before",
};

export function reminderRowLabel(reminder: WatchedLotReminderVm | null): string | null {
  return reminder ? ROW_LABEL[reminder.kind] : null;
}

export type ReminderOption = {
  value: WatchedLotReminderKind;
  label: string;
  /** When it would arrive: "26 Nov, 18:00", or why it can't be chosen. */
  description: string;
  disabledReason?: string;
};

/**
 * The reminder times for a lot, each with when it would arrive. One whose moment has passed
 * (the sale already started, less than a day left) can't be chosen, and says so.
 */
export function reminderOptions(
  lot: { startsAt: number; closesAt: number },
  now: Date,
): ReminderOption[] {
  const times = { startTime: new Date(lot.startsAt), endTime: new Date(lot.closesAt) };
  return WATCHED_LOT_REMINDER_KINDS.map((kind) => {
    const due = watchedLotReminderDueAt(kind, times);
    const passed = !due || due.getTime() <= now.getTime();
    const when = due ? formatDateTimeShort(due) : "";
    return {
      value: kind,
      label: OPTION_LABEL[kind],
      description: when,
      ...(passed
        ? {
            disabledReason: kind === "sale_start" ? "The sale has started" : "That time has passed",
          }
        : {}),
    };
  });
}

/** The first time still to come, for a new reminder; `null` when none is left. */
export function defaultReminderKind(
  options: readonly ReminderOption[],
): WatchedLotReminderKind | null {
  const open = options.filter((option) => !option.disabledReason);
  return (open.find((o) => o.value === "day_before_close") ?? open[0])?.value ?? null;
}
