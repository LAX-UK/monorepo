"use client";

import { FileAttachment } from "@auction/ui/lax";
import {
  Archive,
  ArrowDown,
  Check,
  CircleAlert,
  LoaderCircle,
  Lock,
  RotateCcw,
  RotateCw,
  Upload,
  UserPlus,
} from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";

/**
 * A conversation as staff read it: messages from both sides, staff-only notes, quiet one-line
 * events, day dividers and a "New" marker, at the staff density (13px meta, 14/22 reading text up
 * to 72 characters). The list is a named log that announces new messages without moving anyone
 * who is reading further up.
 */

export type ThreadTime = {
  /** "29 Oct, 16:40", or the time today. */
  label: string;
  /** ISO time for the `<time>` element. */
  dateTime: string;
  /** The full date and time, in the tooltip. */
  full: string;
};

export type ThreadAttachment = {
  id: string;
  name: string;
  href: string;
  kind: "image" | "pdf";
  size: string | null;
  thumbnailUrl?: string | null;
};

export type ThreadMessage = {
  type: "message";
  id: string;
  author: {
    name: string;
    initials: string;
    /** "Modern British specialist", "Northbank Gallery, consignor". */
    role?: string | null;
    /** Staff sign with the filled ink avatar; clients with the sunken one. */
    side: "staff" | "client";
  };
  /** A staff-only note: dashed edge, the lock label, never mistaken for a reply. */
  note?: boolean;
  time: ThreadTime;
  body: string;
  attachments: readonly ThreadAttachment[];
  /** "Read by Northbank Gallery · 29 Oct, 17:02", under the last reply the client read. */
  receipt?: string | null;
  /** A reply on its way, or one that did not go. */
  delivery?:
    | { state: "sending" }
    | { state: "failed"; message: string; onRetry: () => void; onEdit: () => void }
    | null;
  /** A control beside the time, e.g. "Undo" while a reply can still be taken back. */
  action?: React.ReactNode;
};

export type ThreadEventIcon = "sent" | "assigned" | "covering" | "closed" | "reopened";

export type ThreadEvent = {
  type: "event";
  id: string;
  icon: ThreadEventIcon;
  text: string;
  time: ThreadTime;
};

export type ThreadDivider =
  | { type: "day"; id: string; label: string }
  | { type: "new"; id: string };

export type ThreadItem = ThreadMessage | ThreadEvent | ThreadDivider;

const EVENT_ICONS: Record<ThreadEventIcon, typeof Upload> = {
  sent: Upload,
  assigned: UserPlus,
  covering: UserPlus,
  closed: Archive,
  reopened: RotateCw,
};

function Avatar({ initials, side }: { initials: string; side: "staff" | "client" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full text-staff-xs font-semibold",
        side === "staff"
          ? "bg-staff-ink text-staff-on-ink"
          : "border border-staff-line bg-staff-sunken text-staff-fg",
      )}
    >
      {initials}
    </span>
  );
}

function Time({ time }: { time: ThreadTime }) {
  return (
    <time dateTime={time.dateTime} title={time.full}>
      {time.label}
    </time>
  );
}

function MessageRow({ message }: { message: ThreadMessage }) {
  const failed = message.delivery?.state === "failed" ? message.delivery : null;
  const sending = message.delivery?.state === "sending";
  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3" data-thread-message={message.id}>
      <Avatar initials={message.author.initials} side={message.author.side} />
      <div className="min-w-0">
        <p className="mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-staff-sm leading-5 text-staff-muted">
          {message.note ? (
            <span className="inline-flex items-center gap-1 rounded-staff-xs bg-staff-ink px-1.5 text-staff-xs leading-5 font-medium text-staff-on-ink">
              <Lock aria-hidden className="size-3" strokeWidth={2} />
              Internal note
            </span>
          ) : null}
          <span className="font-semibold text-staff-fg">{message.author.name}</span>
          {message.author.role ? <span>· {message.author.role}</span> : null}
          {sending ? (
            <span className="inline-flex items-center gap-1">
              <LoaderCircle aria-hidden className="size-3.5 animate-spin" strokeWidth={1.75} />
              Sending…
            </span>
          ) : (
            <span>
              · <Time time={message.time} />
            </span>
          )}
          {message.note ? <span>· only staff can see this</span> : null}
          {message.action ? <span className="ml-1">{message.action}</span> : null}
        </p>
        <div
          className={cn(
            "w-fit max-w-[72ch] rounded-staff-lg rounded-tl-staff-xs px-3.5 py-2.5 text-staff-md leading-[22px] text-staff-fg",
            message.note
              ? "border border-dashed border-staff-control-border bg-transparent"
              : failed
                ? "border border-staff-danger bg-staff-surface"
                : "bg-staff-sunken",
            sending && "text-staff-muted",
          )}
        >
          {message.body ? <p className="break-words whitespace-pre-line">{message.body}</p> : null}
          {message.attachments.length > 0 ? (
            <ul
              aria-label="Files"
              className={cn("flex flex-col gap-2", message.body ? "mt-2.5" : null)}
            >
              {message.attachments.map((file) => (
                <li key={file.id} className="max-w-full">
                  <FileAttachment
                    name={file.name}
                    href={file.href}
                    kind={file.kind}
                    size={file.size}
                    thumbnailUrl={file.thumbnailUrl ?? null}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {failed ? (
          <div role="alert" className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="inline-flex items-center gap-1.5 text-staff-sm text-staff-danger">
              <CircleAlert aria-hidden className="size-4" strokeWidth={1.75} />
              {failed.message}
            </p>
            <StaffButton
              variant="ghost"
              size="sm"
              icon={<RotateCcw aria-hidden />}
              onClick={failed.onRetry}
            >
              Retry
            </StaffButton>
            <StaffButton variant="ghost" size="sm" onClick={failed.onEdit}>
              Edit
            </StaffButton>
          </div>
        ) : null}
        {message.receipt ? (
          <p className="mt-1.5 inline-flex items-center gap-1 text-staff-xs text-staff-muted">
            <Check aria-hidden className="size-3.5" strokeWidth={1.75} />
            {message.receipt}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function EventRow({ event }: { event: ThreadEvent }) {
  const Icon = EVENT_ICONS[event.icon];
  return (
    <li className="flex items-start gap-2 pl-10 text-staff-xs leading-5 text-staff-muted">
      <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
      <p className="min-w-0">
        {event.text} · <Time time={event.time} />
      </p>
    </li>
  );
}

function DividerRow({ divider }: { divider: ThreadDivider }) {
  const isNew = divider.type === "new";
  return (
    <li className="flex items-center gap-3" aria-label={isNew ? "New messages" : undefined}>
      <span
        aria-hidden
        className={cn("h-px flex-1", isNew ? "bg-staff-fg" : "bg-staff-line-subtle")}
      />
      <span
        className={cn(
          "text-staff-xs",
          isNew ? "font-semibold text-staff-fg" : "font-medium text-staff-muted",
        )}
      >
        {isNew ? "New" : divider.label}
      </span>
      <span
        aria-hidden
        className={cn("h-px flex-1", isNew ? "bg-staff-fg" : "bg-staff-line-subtle")}
      />
    </li>
  );
}

export type MessageThreadProps = {
  items: readonly ThreadItem[];
  /** The log's accessible name: "Messages with Northbank Gallery". */
  label: string;
  /** Older messages folded away: "Show 14 earlier messages". */
  earlier?: { count: number; onShow: () => void } | null;
  /** Shown when there is nothing yet. */
  empty?: React.ReactNode;
  className?: string;
};

/**
 * The thread itself. Older messages can be folded behind "Show N earlier", and once the newest
 * message is out of view a "Jump to latest" control brings it back; the page never scrolls on
 * its own.
 */
export function MessageThread({ items, label, earlier, empty, className }: MessageThreadProps) {
  const end = React.useRef<HTMLDivElement>(null);
  const [endVisible, setEndVisible] = React.useState(true);

  React.useEffect(() => {
    const node = end.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) =>
      setEndVisible(Boolean(entry?.isIntersecting)),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (items.length === 0 && empty) {
    return <div className={cn("px-4 py-10 text-center", className)}>{empty}</div>;
  }

  return (
    <div className={cn("relative flex flex-col gap-4 px-4 py-4", className)}>
      {earlier && earlier.count > 0 ? (
        <div className="flex justify-center">
          <StaffButton size="sm" onClick={earlier.onShow}>
            Show {earlier.count} earlier {earlier.count === 1 ? "message" : "messages"}
          </StaffButton>
        </div>
      ) : null}
      <div role="log" aria-label={label} aria-live="polite">
        <ol className="flex flex-col gap-4">
          {items.map((item) =>
            item.type === "message" ? (
              <MessageRow key={item.id} message={item} />
            ) : item.type === "event" ? (
              <EventRow key={item.id} event={item} />
            ) : (
              <DividerRow key={item.id} divider={item} />
            ),
          )}
        </ol>
      </div>
      <div ref={end} aria-hidden className="h-px" />
      {!endVisible && items.length > 0 ? (
        <div className="pointer-events-none sticky bottom-3 flex justify-center">
          <StaffButton
            size="sm"
            className="pointer-events-auto shadow-staff-md"
            icon={<ArrowDown aria-hidden />}
            onClick={() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" })}
          >
            Jump to latest
          </StaffButton>
        </div>
      ) : null}
    </div>
  );
}
