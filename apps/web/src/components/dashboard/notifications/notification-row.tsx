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

/** Tailwind class fragments for each {@link NotificationTone}. Centralised
 * here so colour decisions live next to the row component that uses them.
 */
const TONE_STYLES: Record<NotificationTone, { bg: string; fg: string; ring: string }> = {
  neutral: {
    bg: "bg-surface-container-high/70",
    fg: "text-on-surface",
    ring: "ring-outline-variant/30",
  },
  info: {
    bg: "bg-tertiary-container/40",
    fg: "text-on-tertiary-container",
    ring: "ring-tertiary/30",
  },
  success: {
    bg: "bg-success/15",
    fg: "text-success",
    ring: "ring-success/30",
  },
  warn: {
    bg: "bg-primary-container/30",
    fg: "text-primary",
    ring: "ring-primary/30",
  },
  danger: {
    bg: "bg-error/15",
    fg: "text-error",
    ring: "ring-error/30",
  },
};

export type NotificationRowProps = {
  item: UserNotification;
  presentation: NotificationPresentation;
  selected: boolean;
  selectionActive: boolean;
  onToggleSelect: (id: string) => void;
  onMarkRead: (id: string) => void;
  onArchive: (id: string) => void;
};

/** Dumb row component. No fetching, no URL state, no global side effects.
 *
 * Layout: tinted type icon - title/message/meta block - inline action -
 * overflow menu. Selection checkbox sits to the very left and only appears
 * on hover/focus unless any row is already selected (then it stays visible).
 */
export function NotificationRow({
  item,
  presentation,
  selected,
  selectionActive,
  onToggleSelect,
  onMarkRead,
  onArchive,
}: NotificationRowProps) {
  const unread = !item.read;
  const tone = TONE_STYLES[presentation.tone];
  const { Icon, label } = presentation;
  const href = notificationHref(item);

  return (
    <li
      aria-label={unread ? `Unread: ${item.title}` : item.title}
      className={cn(
        "group relative flex items-start gap-3 border-b border-border-hairline px-4 py-4 transition-colors last:border-b-0 hover:bg-surface-container-high/40 focus-within:bg-surface-container-high/40",
        unread
          ? "border-l-2 border-l-primary/70 bg-primary-container/5"
          : "border-l-2 border-l-transparent",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center pt-1",
          selectionActive
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
        )}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(item.id)}
          aria-label={`Select notification: ${item.title}`}
        />
      </div>

      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full ring-1",
          tone.bg,
          tone.ring,
        )}
        aria-hidden
      >
        <Icon className={cn("size-4", tone.fg)} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p
            className={cn(
              "font-headline text-sm text-on-surface",
              unread ? "font-semibold" : "font-medium text-on-surface-variant",
            )}
          >
            {href ? (
              <Link
                href={href}
                className="underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                onClick={() => {
                  if (unread) onMarkRead(item.id);
                }}
              >
                {item.title}
              </Link>
            ) : (
              item.title
            )}
          </p>
          <time
            dateTime={item.createdAt.toISOString()}
            title={item.createdAt.toLocaleString()}
            className="shrink-0 font-label text-[11px] uppercase tracking-wider tabular-nums text-on-surface-variant"
          >
            {relativeTime(item.createdAt)}
          </time>
        </div>
        <p
          className={cn(
            "mt-1 line-clamp-2 font-body text-sm text-on-surface-variant",
            item.read ? "opacity-80" : "",
          )}
        >
          {item.message}
        </p>
        <p className="mt-1 font-label text-[11px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant/80">
          {label}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {href ? (
          <Button variant="ctaLink" asChild>
            <Link
              href={href}
              onClick={() => {
                if (unread) onMarkRead(item.id);
              }}
            >
              View
            </Link>
          </Button>
        ) : unread ? (
          <Button type="button" variant="ctaLink" onClick={() => onMarkRead(item.id)}>
            Mark read
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 rounded-md text-on-surface hover:bg-surface-container-high"
              aria-label={`Row actions for ${item.title}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={!unread} onSelect={() => onMarkRead(item.id)}>
              Mark as read
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onArchive(item.id)}>Archive</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
