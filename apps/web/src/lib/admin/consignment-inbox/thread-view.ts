import {
  type ThreadItem,
  type ThreadMessage,
  type ThreadTime,
  initialsOf,
} from "@auction/staff-ui";
import type {
  ConsignmentThreadAttachmentView,
  ConsignmentThreadDetail,
  ConsignmentThreadEventView,
  ConsignmentThreadMessageView,
} from "@auction/validators";

/**
 * A thread as staff read it: messages and events in time order, a divider for each day, a "New"
 * marker before the first client message nobody at LAX had read when the page opened, the read
 * receipt under the last reply the client read, and older messages folded once it grows long.
 */

const ZONE = "Europe/London";
const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ZONE,
});
const DAY_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ZONE,
});
const WEEKDAY_TIME = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ZONE,
});
const DAY_LONG = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: ZONE,
});
const DAY_LONG_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: ZONE,
});
const FULL = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ZONE,
});
const DATE_KEY = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: ZONE,
});
const YEAR = new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: ZONE });

/** Messages shown before older ones fold behind "Show N earlier". */
export const THREAD_VISIBLE_MESSAGES = 8;
/** A thread folds only once it holds more than this many messages. */
export const THREAD_FOLD_AFTER = 12;

/** "14:05" today, "Sat 31 Oct, 10:15" this week, else "27 Oct, 14:05". */
export function threadTime(iso: string, now: Date): ThreadTime {
  const at = new Date(iso);
  const sameDay = DATE_KEY.format(at) === DATE_KEY.format(now);
  const days = (now.getTime() - at.getTime()) / 86_400_000;
  const label = sameDay
    ? TIME.format(at)
    : days < 6
      ? WEEKDAY_TIME.format(at)
      : DAY_TIME.format(at);
  return { label: label.replace(" at ", ", "), dateTime: at.toISOString(), full: FULL.format(at) };
}

function dayLabel(at: Date, now: Date): string {
  return YEAR.format(at) === YEAR.format(now) ? DAY_LONG.format(at) : DAY_LONG_YEAR.format(at);
}

/** "2.1 MB", "340 KB". */
export function fileSize(bytes: number | null): string | null {
  if (bytes == null || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function attachment(file: ConsignmentThreadAttachmentView) {
  const kind = file.contentType === "application/pdf" ? ("pdf" as const) : ("image" as const);
  return {
    id: file.id,
    name: file.fileName,
    href: file.url,
    kind,
    size: fileSize(file.byteSize),
    thumbnailUrl: kind === "image" ? file.url : null,
  };
}

/** What an event says: "Assigned to Clara Mendes by James Hale". */
export function eventText(event: ConsignmentThreadEventView): string {
  const by = event.actor ? ` by ${event.actor.name}` : "";
  const who = event.subject?.name ?? "a colleague";
  switch (event.kind) {
    case "assigned":
      return `Assigned to ${who}${by}`;
    case "unassigned":
      return `Unassigned${by}`;
    case "covering":
      return `${who} covering this thread${event.actor && event.actor.userId !== event.subject?.userId ? `, set by ${event.actor.name}` : ""}`;
    case "closed":
      return `Closed${by}: no reply needed`;
    case "reopened":
      return event.actor
        ? `Reopened by ${event.actor.name}`
        : "Reopened when the client wrote again";
  }
}

const EVENT_ICON = {
  assigned: "assigned",
  unassigned: "assigned",
  covering: "covering",
  closed: "closed",
  reopened: "reopened",
} as const;

type Entry =
  | { at: number; order: number; message: ConsignmentThreadMessageView }
  | { at: number; order: number; event: ConsignmentThreadEventView };

export type ThreadViewOptions = {
  now: Date;
  /** The id of the first client message unread when the page opened, for the "New" marker. */
  firstUnreadId: string | null;
  /** Show every message, not only the latest. */
  expanded: boolean;
  /** The account's name, for the read receipt. */
  accountName: string | null;
};

export type ThreadView = {
  items: ThreadItem[];
  /** Messages folded away, 0 when everything shows. */
  hiddenCount: number;
  messageCount: number;
};

/** The first client message LAX had not read: where the "New" marker goes. */
export function firstUnreadClientMessageId(
  detail: Pick<ConsignmentThreadDetail, "messages">,
): string | null {
  return (
    detail.messages.find((m) => m.side === "client" && m.visibility === "thread" && !m.readAt)
      ?.id ?? null
  );
}

export function buildThreadView(
  detail: Pick<ConsignmentThreadDetail, "messages" | "events">,
  options: ThreadViewOptions,
): ThreadView {
  const entries: Entry[] = [
    ...detail.messages.map((message, order) => ({
      at: Date.parse(message.createdAt),
      order,
      message,
    })),
    ...detail.events.map((event, order) => ({
      at: Date.parse(event.at),
      order: 10_000 + order,
      event,
    })),
  ].sort((a, b) => a.at - b.at || a.order - b.order);

  const messageCount = detail.messages.length;
  const fold = !options.expanded && messageCount > THREAD_FOLD_AFTER;
  const keepFrom = fold
    ? Date.parse(detail.messages[messageCount - THREAD_VISIBLE_MESSAGES]?.createdAt ?? "0")
    : Number.NEGATIVE_INFINITY;
  const shown = fold ? entries.filter((entry) => entry.at >= keepFrom) : entries;

  // The receipt goes under the newest reply the client has read.
  const receiptFor = [...detail.messages]
    .reverse()
    .find((m) => m.side === "staff" && m.visibility === "thread" && m.readAt);

  const items: ThreadItem[] = [];
  let lastDay: string | null = null;
  for (const entry of shown) {
    const day = DATE_KEY.format(new Date(entry.at));
    if ("message" in entry && entry.message.id === options.firstUnreadId) {
      items.push({ type: "new", id: `new-${entry.message.id}` });
      lastDay = day;
    } else if (day !== lastDay) {
      items.push({
        type: "day",
        id: `day-${day}`,
        label: dayLabel(new Date(entry.at), options.now),
      });
      lastDay = day;
    }
    if ("event" in entry) {
      items.push({
        type: "event",
        id: entry.event.id,
        icon: EVENT_ICON[entry.event.kind],
        text: eventText(entry.event),
        time: threadTime(entry.event.at, options.now),
      });
      continue;
    }
    const m = entry.message;
    const item: ThreadMessage = {
      type: "message",
      id: m.id,
      author: {
        name: m.author.name,
        initials: initialsOf(m.author.name),
        role: m.author.role,
        side: m.side,
      },
      note: m.visibility === "internal",
      time: threadTime(m.createdAt, options.now),
      body: m.body,
      attachments: m.attachments.map(attachment),
      receipt:
        receiptFor?.id === m.id && m.readAt
          ? `Read by ${options.accountName ?? "the client"} · ${threadTime(m.readAt, options.now).label}`
          : null,
    };
    items.push(item);
  }
  return {
    items,
    hiddenCount: fold ? messageCount - THREAD_VISIBLE_MESSAGES : 0,
    messageCount,
  };
}

/** "Messages with Northbank Gallery", and "4 messages". */
export function threadHeading(detail: Pick<ConsignmentThreadDetail, "account" | "messages">) {
  const count = detail.messages.length;
  return {
    title: detail.account ? `Messages with ${detail.account.name}` : "Messages with the client",
    count: count === 0 ? null : `${count} ${count === 1 ? "message" : "messages"}`,
  };
}

/**
 * Who hears of a reply, as the composer says it: "Lena Fischer, and Northbank Gallery's owners
 * and admins, by email and in Bid."
 */
export function replyRecipients(
  detail: Pick<ConsignmentThreadDetail, "account" | "people">,
): string {
  const account = detail.account;
  const sender = detail.people.sender?.name ?? null;
  if (!account)
    return sender ? `${sender}, by email and in Bid.` : "The client, by email and in Bid.";
  if (account.kind === "individual") {
    return `${sender ?? account.name}, by email and in Bid.`;
  }
  const group = `${account.name}’s owners and admins`;
  return sender
    ? `${sender}, and ${group}, by email and in Bid.`
    : `${group}, by email and in Bid.`;
}

/** "Send to Northbank Gallery". */
export function sendLabel(detail: Pick<ConsignmentThreadDetail, "account">): string {
  return detail.account ? `Send to ${detail.account.name}` : "Send";
}

/** "Write to Northbank Gallery…". */
export function replyPlaceholder(detail: Pick<ConsignmentThreadDetail, "account">): string {
  return detail.account ? `Write to ${detail.account.name}…` : "Write to the client…";
}
