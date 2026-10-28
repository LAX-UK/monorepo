"use client";

import { notificationHref } from "@/lib/notifications/notification-link";
import type { UserNotification } from "@auction/types";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { NotificationPresentation, NotificationTone } from "./notification-presenters";
import { relativeTime } from "./notification-presenters";

/** The icon disc per tone; the status `*-on-surface` tokens keep the glyph at 3:1 or more. */
const TONE_STYLES: Record<NotificationTone, string> = {
  neutral: "bg-surface-container-high text-on-surface",
  info: "bg-info-container text-info",
  success: "bg-success-container text-on-success-container",
  warn: "bg-warning-container text-warning-on-surface",
  danger: "bg-danger-container text-danger-on-surface",
};

export type NotificationRowProps = {
  item: UserNotification;
  presentation: NotificationPresentation;
  onMarkRead: (id: string) => void;
};

/**
 * One notification: its type disc, the title (bold while unread), what happened, when, and an
 * unread dot. Opening a notification marks it read; the dot itself also marks it read, for the
 * notifications that lead nowhere.
 */
export function NotificationRow({ item, presentation, onMarkRead }: NotificationRowProps) {
  const unread = !item.read;
  const { Icon } = presentation;
  const href = notificationHref(item);
  const title = href ? (
    <Link
      href={href}
      className="after:absolute after:inset-0 focus-visible:outline-none"
      onClick={() => {
        if (unread) onMarkRead(item.id);
      }}
    >
      {item.title}
    </Link>
  ) : (
    item.title
  );

  return (
    <li
      className={cn(
        "group relative flex items-start gap-3.5 px-4 py-4 md:px-5",
        href &&
          "motion-safe:transition-colors hover:bg-surface-container-low has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-ring",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          TONE_STYLES[presentation.tone],
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-body text-[0.9375rem] leading-snug text-on-surface",
            unread ? "font-semibold" : "font-normal",
          )}
        >
          {unread ? <span className="sr-only">Unread: </span> : null}
          {title}
        </p>
        {item.message ? (
          <p className="mt-1 line-clamp-2 font-body text-sm text-on-surface-variant">
            {item.message}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <time
          dateTime={item.createdAt.toISOString()}
          title={item.createdAt.toLocaleString("en-GB")}
          className="font-body text-xs tabular-nums text-on-surface-variant"
        >
          {relativeTime(item.createdAt)}
        </time>
        {unread ? (
          <Button
            type="button"
            variant="ghost"
            size="link"
            onClick={() => onMarkRead(item.id)}
            aria-label={`Mark as read: ${item.title}`}
            className="relative z-[1] -m-2 size-8 rounded-full focus-visible:ring-offset-0"
          >
            <span className="size-2 rounded-full bg-[var(--color-product-accent,var(--color-on-surface))]" />
          </Button>
        ) : (
          <span aria-hidden className="size-4" />
        )}
      </div>
    </li>
  );
}
