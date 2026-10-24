import type * as React from "react";
import { cn } from "../lib/cn.js";
import type { StaffStatusTone } from "../tokens.js";

export type TimelineEvent = {
  id: string;
  /** What happened, in a sentence: "Refund of £20.00 requested". */
  title: React.ReactNode;
  /** ISO timestamp. */
  at: string;
  /** Who did it, when known: a name, "System" or "Stripe". */
  actor?: string;
  /** Extra detail, e.g. a reason or a tracking number. */
  detail?: React.ReactNode;
  tone?: StaffStatusTone;
};

const dotTone: Record<StaffStatusTone, string> = {
  neutral: "bg-staff-neutral-dot",
  info: "bg-staff-info-dot",
  success: "bg-staff-success-dot",
  warning: "bg-staff-warning-dot",
  danger: "bg-staff-danger-dot",
};

const TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

export function formatStaffDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : TIME.format(date);
}

/**
 * Activity and audit history, newest first: a dot on a hairline rail, the event in a sentence,
 * then who and when. Used on record pages and for the global audit log.
 */
export function Timeline({
  events,
  label,
  empty = "Nothing has happened yet.",
  className,
}: {
  events: readonly TimelineEvent[];
  label: string;
  empty?: string;
  className?: string;
}) {
  if (events.length === 0) {
    return <p className={cn("text-staff-sm text-staff-muted", className)}>{empty}</p>;
  }
  return (
    <ol aria-label={label} className={cn("relative", className)}>
      {events.map((event, index) => (
        <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
          {index < events.length - 1 ? (
            <span aria-hidden className="absolute top-4 bottom-0 left-[3.5px] w-px bg-staff-line" />
          ) : null}
          <span
            aria-hidden
            className={cn(
              "relative mt-1.5 size-2 shrink-0 rounded-full ring-4 ring-staff-surface",
              dotTone[event.tone ?? "neutral"],
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="text-staff-sm text-staff-fg">{event.title}</p>
            {event.detail ? (
              <div className="mt-0.5 text-staff-sm text-staff-muted">{event.detail}</div>
            ) : null}
            <p className="mt-0.5 text-staff-xs text-staff-subtle">
              {event.actor ? <span>{event.actor} · </span> : null}
              <time dateTime={event.at}>{formatStaffDateTime(event.at)}</time>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
