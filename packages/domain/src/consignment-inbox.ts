import {
  CONSIGNMENT_INBOX_READ_ACCESS,
  CONSIGNMENT_INBOX_REPLY_ACCESS,
  CONSIGNMENT_SAVED_REPLIES_MANAGE_ACCESS,
  type StaffRoles,
  type UserRole,
  userHasAccessTo,
} from "@auction/types";
import type { ConsignmentMessageSide } from "./consignment-messages.js";
import {
  LONDON_WORKING_CALENDAR,
  type WorkingCalendar,
  addWorkingMinutes,
  workingMinutesBetween,
} from "./working-hours.js";

/**
 * The staff side of consignment messages: who may do what, how long a client has waited and
 * when the first answer is due, and the small rules the inbox and the thread share.
 */

/** Who can read a message: both sides, or staff only (an internal note). */
export const CONSIGNMENT_MESSAGE_VISIBILITIES = ["thread", "internal"] as const;
export type ConsignmentMessageVisibility = (typeof CONSIGNMENT_MESSAGE_VISIBILITIES)[number];

/** A client is answered within one working day (09:00–18:00, so nine working hours). */
export const FIRST_REPLY_TARGET_WORKING_MINUTES = 9 * 60;
/** Under two working hours left, the answer is due soon. */
export const REPLY_DUE_SOON_WORKING_MINUTES = 2 * 60;
/** A reply can be taken back for this long; the client hears of it only afterwards. */
export const CONSIGNMENT_REPLY_UNDO_MS = 10_000;

/**
 * A reply whose hold ended this long ago and still has not told the account is picked up by the
 * sweep. The wait keeps the sweep from racing the delivery job that normally does it.
 */
export const REPLY_NOTICE_SWEEP_GRACE_MS = 2 * 60_000;

export type ReplyClockState = "on_track" | "due_soon" | "overdue";

export type ReplyClock = {
  state: ReplyClockState;
  /** Working minutes the client has waited. */
  waitedMinutes: number;
  /** When the answer is due. */
  dueAt: Date;
  /** Working minutes left before it is due; 0 once overdue. */
  remainingMinutes: number;
  /** Working minutes past the due time; 0 until then. */
  overdueMinutes: number;
};

/**
 * How long a client has waited for an answer, and how close it is to late, counted in working
 * time from the first unanswered message.
 */
export function replyClock(
  waitingSince: Date,
  now: Date,
  calendar: WorkingCalendar = LONDON_WORKING_CALENDAR,
): ReplyClock {
  const dueAt = addWorkingMinutes(calendar, waitingSince, FIRST_REPLY_TARGET_WORKING_MINUTES);
  const waitedMinutes = workingMinutesBetween(calendar, waitingSince, now);
  if (now.getTime() >= dueAt.getTime()) {
    return {
      state: "overdue",
      waitedMinutes,
      dueAt,
      remainingMinutes: 0,
      overdueMinutes: workingMinutesBetween(calendar, dueAt, now),
    };
  }
  const remainingMinutes = workingMinutesBetween(calendar, now, dueAt);
  return {
    state: remainingMinutes <= REPLY_DUE_SOON_WORKING_MINUTES ? "due_soon" : "on_track",
    waitedMinutes,
    dueAt,
    remainingMinutes,
    overdueMinutes: 0,
  };
}

/** Where a thread stands for staff: the client waits, the client has an answer, or closed. */
export type ConsignmentThreadStatus = "waiting_on_us" | "answered" | "closed";

export function consignmentThreadStatus(thread: {
  closedAt: Date | null;
  /** The side of the newest message the client can read (notes do not count). */
  lastVisibleSide: ConsignmentMessageSide | null;
}): ConsignmentThreadStatus {
  if (thread.closedAt) return "closed";
  return thread.lastVisibleSide === "client" ? "waiting_on_us" : "answered";
}

/**
 * The inbox's built-in views: what waits for an answer (every open thread whose newest visible
 * message is the client's), what is the viewer's, everything, and what was closed.
 */
export const CONSIGNMENT_INBOX_VIEWS = ["unanswered", "mine", "all", "closed"] as const;
export type ConsignmentInboxView = (typeof CONSIGNMENT_INBOX_VIEWS)[number];

export const CONSIGNMENT_INBOX_SORTS = ["waiting", "latest", "oldest", "sale_date"] as const;
export type ConsignmentInboxSort = (typeof CONSIGNMENT_INBOX_SORTS)[number];

/** Queues of work sort by the longest wait; the record views by the latest activity. */
export function defaultConsignmentInboxSort(view: ConsignmentInboxView): ConsignmentInboxSort {
  return view === "unanswered" || view === "mine" ? "waiting" : "latest";
}

/** What a member of staff may do with consignment threads, from their roles. */
export type ConsignmentInboxAbilities = {
  canRead: boolean;
  canReply: boolean;
  canAssign: boolean;
  canClose: boolean;
  canManageSavedReplies: boolean;
};

export function consignmentInboxAbilities(
  role: UserRole,
  staffRoles: StaffRoles | undefined,
): ConsignmentInboxAbilities {
  const canRead = userHasAccessTo(role, staffRoles, CONSIGNMENT_INBOX_READ_ACCESS);
  const canReply = canRead && userHasAccessTo(role, staffRoles, CONSIGNMENT_INBOX_REPLY_ACCESS);
  return {
    canRead,
    canReply,
    canAssign: canReply,
    canClose: canReply,
    canManageSavedReplies:
      canRead && userHasAccessTo(role, staffRoles, CONSIGNMENT_SAVED_REPLIES_MANAGE_ACCESS),
  };
}

/** Replies held until before this moment, and still unannounced, are overdue for their notice. */
export function replyNoticeSweepCutoff(now: Date): Date {
  return new Date(now.getTime() - REPLY_NOTICE_SWEEP_GRACE_MS);
}

/** A reply is overdue for its notice once its hold ended before the cutoff and nobody was told. */
export function isReplyNoticeOverdue(
  reply: { deliverAfter: Date | null; notifiedAt: Date | null },
  now: Date,
): boolean {
  return (
    reply.notifiedAt === null &&
    reply.deliverAfter !== null &&
    reply.deliverAfter.getTime() <= replyNoticeSweepCutoff(now).getTime()
  );
}

/** A cover with an end date is over once that moment has passed; without one it runs on. */
export function coverHasEnded(coveringUntil: Date | null, now: Date): boolean {
  return coveringUntil !== null && coveringUntil.getTime() <= now.getTime();
}

/** Why a cover end date cannot be used, or null when it can: it must be a future moment. */
export function coverEndError(coveringUntil: Date, now: Date): string | null {
  return coveringUntil.getTime() > now.getTime() ? null : "Choose an end date in the future.";
}

/** Who has a thread: whoever covers it for now, else the consignment's specialist. */
export function threadAssignee<T extends { userId: string }>(input: {
  specialist: T | null;
  covering: T | null;
}): (T & { covering: boolean }) | null {
  if (input.covering) return { ...input.covering, covering: true };
  if (input.specialist) return { ...input.specialist, covering: false };
  return null;
}

/**
 * Messages the client wrote after the one the writer last saw: a reply drafted against an older
 * thread pauses so they can read what is new first. Empty when nothing new came in, or when the
 * message they saw is no longer known (the check then lets the reply through).
 */
export function messagesSinceSeen<T extends { id: string; side: ConsignmentMessageSide }>(
  messages: readonly T[],
  lastSeenMessageId: string | null | undefined,
): T[] {
  if (!lastSeenMessageId) return [];
  const index = messages.findIndex((message) => message.id === lastSeenMessageId);
  if (index < 0) return [];
  return messages.slice(index + 1).filter((message) => message.side === "client");
}

/** The words a saved reply can carry, filled in from the thread when it is inserted. */
export const SAVED_REPLY_PLACEHOLDERS = {
  clientFirstName: "{client first name}",
  workTitle: "{work title}",
  saleName: "{sale name}",
} as const;
export type SavedReplyPlaceholder = keyof typeof SAVED_REPLY_PLACEHOLDERS;

export const SAVED_REPLY_TITLE_MAX_LENGTH = 80;
/** About twenty replies keep the menu scannable; more belong in a document. */
export const SAVED_REPLY_LIMIT = 25;

/**
 * A saved reply ready to edit: each placeholder replaced with what the thread knows. One the
 * thread cannot fill stays as written, so the writer sees it and fills it in themselves.
 */
export function fillSavedReply(
  body: string,
  values: Partial<Record<SavedReplyPlaceholder, string | null | undefined>>,
): string {
  let filled = body;
  for (const [key, token] of Object.entries(SAVED_REPLY_PLACEHOLDERS) as [
    SavedReplyPlaceholder,
    string,
  ][]) {
    const value = values[key]?.trim();
    if (value) filled = filled.split(token).join(value);
  }
  return filled;
}

/** The first name to greet someone by: the first word of their name. */
export function firstNameOf(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}
