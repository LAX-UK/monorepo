import { staffRoleLastDay } from "@/lib/admin/people/staff-roles.vm";
import { FIRST_REPLY_TARGET_WORKING_MINUTES } from "@auction/domain";
import type { ConsignmentReplyClockView, ConsignmentThreadAssigneeView } from "@auction/validators";

/**
 * How waiting reads in the inbox. Every duration is working time (Monday to Friday, 09:00–18:00
 * London), so "1d" is one working day of nine hours, never a calendar day.
 */

const ZONE = "Europe/London";
const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ZONE,
});
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: ZONE });
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: ZONE,
});
const DATE_KEY = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: ZONE,
});

const WORKING_DAY = FIRST_REPLY_TARGET_WORKING_MINUTES;

/** "45m", "7h 20m", "1d 3h": working minutes, at most two units. */
export function workingDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total}m`;
  if (total < WORKING_DAY) {
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    return rest ? `${hours}h ${String(rest).padStart(2, "0")}m` : `${hours}h`;
  }
  const days = Math.floor(total / WORKING_DAY);
  const hours = Math.floor((total % WORKING_DAY) / 60);
  return hours ? `${days}d ${hours}h` : `${days}d`;
}

/** "40m", "7h", "2d": the largest unit only, rounded down, for the short cue in a badge. */
export function workingDurationShort(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total}m`;
  if (total < WORKING_DAY) return `${Math.floor(total / 60)}h`;
  return `${Math.floor(total / WORKING_DAY)}d`;
}

/** "1 day 3 hours", "4 hours", "45 minutes": the same, in words for sentences. */
export function workingDurationWords(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (total < 60) return plural(Math.max(total, 1), "minute");
  if (total < WORKING_DAY) return plural(Math.floor(total / 60), "hour");
  const days = Math.floor(total / WORKING_DAY);
  const hours = Math.floor((total % WORKING_DAY) / 60);
  return hours ? `${plural(days, "day")} ${plural(hours, "hour")}` : plural(days, "day");
}

function dayDistance(from: Date, to: Date): number {
  const a = Date.parse(`${DATE_KEY.format(from)}T00:00:00Z`);
  const b = Date.parse(`${DATE_KEY.format(to)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** When a reply is due, as a person would say it: "16:00", "tomorrow 09:45", "Mon 10:00". */
export function dueWhen(dueAt: Date, now: Date): { prefix: string; text: string } {
  const days = dayDistance(now, dueAt);
  const time = TIME.format(dueAt);
  if (days <= 0) return { prefix: "Reply by", text: time };
  if (days === 1) return { prefix: "Reply", text: `tomorrow ${time}` };
  if (days < 7) return { prefix: "Reply by", text: `${WEEKDAY.format(dueAt)} ${time}` };
  return { prefix: "Reply by", text: `${DAY_MONTH.format(dueAt)}, ${time}` };
}

/**
 * The cue under the wait. On track it is quiet text ("Reply by 16:00"); due soon a warning badge
 * ("Due in 40m"); overdue a danger badge with the alert shape ("Overdue 3h"). Shape and words
 * carry it without colour.
 */
export type WaitingCue =
  | { kind: "text"; label: string }
  | { kind: "badge"; label: string; tone: "warning" | "danger" };

export function waitingCue(clock: ConsignmentReplyClockView, now: Date): WaitingCue {
  if (clock.state === "overdue") {
    return {
      kind: "badge",
      tone: "danger",
      label: `Overdue ${workingDurationShort(clock.overdueMinutes)}`,
    };
  }
  if (clock.state === "due_soon") {
    return {
      kind: "badge",
      tone: "warning",
      label: `Due in ${workingDurationShort(clock.remainingMinutes)}`,
    };
  }
  const due = dueWhen(new Date(clock.dueAt), now);
  return { kind: "text", label: `${due.prefix} ${due.text}` };
}

/**
 * "Clara Mendes (you)", "James Hale, covering", "James Hale, covering until 30 Nov 2026", or null
 * when nobody has it.
 */
export function assigneeLabel(
  assignee: ConsignmentThreadAssigneeView | null,
  viewerUserId: string,
): string | null {
  if (!assignee) return null;
  const you = assignee.userId === viewerUserId ? " (you)" : "";
  if (!assignee.covering) return `${assignee.name}${you}`;
  const until = assignee.coveringUntil ? ` until ${staffRoleLastDay(assignee.coveringUntil)}` : "";
  return `${assignee.name}${you}, covering${until}`;
}

/** "Lena: Is the 19 November date fixed?", or "Clara: …" for our own last reply. */
export function lastMessageLine(input: { authorFirstName: string; excerpt: string }): {
  who: string;
  text: string;
} {
  return { who: `${input.authorFirstName}:`, text: input.excerpt || "Sent a file" };
}

/** The words a screen reader hears first for a row: "Unread. Thames at low tide". */
export function threadRowName(input: { title: string; unread: boolean }): string {
  return input.unread ? `Unread. ${input.title}` : input.title;
}

/** The sidebar count, "4 waiting", announced with the item's name; nothing at zero. */
export function inboxNavCount(waiting: number): number | undefined {
  return waiting > 0 ? Math.min(waiting, 999) : undefined;
}
