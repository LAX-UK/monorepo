"use client";

import { notificationHref } from "@/lib/notifications/notification-link";
import type { UserNotification } from "@auction/types";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Checkbox } from "@auction/ui/components/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
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
  onArchive: (id: string) => void;
  /** Selection mode: a checkbox leads the row and the whole row toggles it. */
  selecting?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  /** Archived notifications cannot be archived again. */
  archived?: boolean;
};

/**
 * One notification: its type disc, the title (bold while unread), what happened, when, and an
 * unread dot that marks it read. Its menu marks it read or archives it. In selection mode a
 * checkbox leads the row instead of the link.
 */
export function NotificationRow({
  item,
  presentation,
  onMarkRead,
  onArchive,
  selecting = false,
  selected = false,
  onToggleSelect,
  archived = false,
}: NotificationRowProps) {
  const unread = !item.read;
  const { Icon } = presentation;
  const href = selecting ? null : notificationHref(item);
  const checkboxId = `select-${item.id}`;
  const title = selecting ? (
    <label htmlFor={checkboxId} className="cursor-pointer after:absolute after:inset-0">
      {item.title}
    </label>
  ) : href ? (
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
        (href || selecting) &&
          "motion-safe:transition-colors hover:bg-surface-container-low has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-ring",
        selected && "bg-surface-container-low",
      )}
    >
      {selecting ? (
        <Checkbox
          id={checkboxId}
          checked={selected}
          onCheckedChange={() => onToggleSelect?.(item.id)}
          className="relative z-[1] mt-2.5 size-5"
        />
      ) : null}
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
        {selecting ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="link"
                aria-label={`More for ${item.title}`}
                className="relative z-[1] size-8 rounded-full text-on-surface-variant hover:text-on-surface focus-visible:ring-offset-0"
              >
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={!unread} onSelect={() => onMarkRead(item.id)}>
                Mark as read
              </DropdownMenuItem>
              {archived ? null : (
                <DropdownMenuItem onSelect={() => onArchive(item.id)}>Archive</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  );
}
