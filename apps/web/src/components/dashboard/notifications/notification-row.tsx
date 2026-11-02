"use client";

import { AccountTile } from "@/components/layout/account-switcher/account-tile";
import type { InboxAccountTag, InboxRowView } from "@/lib/notifications/inbox-row.vm";
import { InlineActionMenu, type InlineActionMenuItem, cn } from "@auction/ui";
import { Checkbox } from "@auction/ui/lax";
import Link from "next/link";
import { inboxFullTime, inboxTime } from "./inbox-time";
import { notificationTypePresenter } from "./notification-presenters";

export type NotificationRowActions = {
  /** The row was opened by its link: it is read now. */
  onOpened: (row: InboxRowView) => void;
  /** "Open" in the menu: go to it. */
  onNavigate: (row: InboxRowView) => void;
  onMarkRead: (row: InboxRowView) => void;
  onArchive: (row: InboxRowView) => void;
  onMute: (row: InboxRowView, muted: boolean) => void;
};

/** "Northbank Gallery" or "Personal", with the account's tile, under the row's line. */
export function AccountTag({ account }: { account: InboxAccountTag }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-lax-12 font-medium text-lax-fg">
      <AccountTile account={account} size="xs" />
      <span className="truncate">{account.name}</span>
    </span>
  );
}

/**
 * One notification: what it is about (its type), what happened, the account it belongs to and
 * when. A bar at its start and a bolder title mark it unread. The whole row opens it; the box
 * picks it for several at once (wide screens), and the "…" menu holds every action, phones
 * included.
 */
export function NotificationRow({
  row,
  archived,
  selection,
  actions,
}: {
  row: InboxRowView;
  /** Archived notifications cannot be archived again. */
  archived: boolean;
  selection: { selected: boolean; onSelectedChange: (selected: boolean) => void };
  actions: NotificationRowActions;
}) {
  const { Icon, label } = notificationTypePresenter(row.type);
  const when = inboxTime(row.createdAt);
  const time = (className: string) => (
    <time
      dateTime={row.createdAt.toISOString()}
      title={inboxFullTime(row.createdAt)}
      className={cn("text-lax-13 tabular-nums text-lax-muted", className)}
    >
      {when}
    </time>
  );
  const menu: InlineActionMenuItem[] = [
    ...(row.href
      ? [{ type: "item" as const, label: "Open", onSelect: () => actions.onNavigate(row) }]
      : []),
    ...(row.unread
      ? [{ type: "item" as const, label: "Mark as read", onSelect: () => actions.onMarkRead(row) }]
      : []),
    ...(archived
      ? []
      : [{ type: "item" as const, label: "Archive", onSelect: () => actions.onArchive(row) }]),
    ...(row.mute
      ? [
          { type: "separator" as const },
          {
            type: "item" as const,
            label: row.mute.muted
              ? `Notify me about ${row.mute.name} again`
              : `Don't notify me about ${row.mute.name}`,
            onSelect: () => actions.onMute(row, !row.mute?.muted),
          },
        ]
      : []),
  ];

  return (
    <li
      data-unread={row.unread || undefined}
      className={cn(
        "group/row relative flex items-start gap-3 py-3 pr-2 pl-4 md:items-center md:gap-4 md:pr-3 md:pl-5",
        "min-h-[72px] md:min-h-16",
        "motion-safe:transition-colors motion-safe:duration-150",
        row.href && "hover:bg-lax-hover",
        selection.selected && "bg-lax-selected hover:bg-lax-selected",
        "has-[[data-row-link]:focus-visible]:outline-2 has-[[data-row-link]:focus-visible]:-outline-offset-2 has-[[data-row-link]:focus-visible]:outline-lax-focus has-[[data-row-link]:focus-visible]:outline-solid",
        row.unread &&
          "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-lax-fg",
      )}
    >
      <span className="relative z-10 -my-2 -ml-2 hidden size-11 shrink-0 items-center justify-center md:inline-flex">
        <Checkbox
          checked={selection.selected}
          onCheckedChange={(checked) => selection.onSelectedChange(checked === true)}
          aria-label={`Select: ${row.title}`}
        />
      </span>
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-lax-control bg-lax-sunken text-lax-muted shadow-[inset_0_0_0_1px_var(--lax-line)]"
      >
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-lax-14 text-lax-fg md:truncate",
            row.unread ? "font-semibold" : "font-medium",
          )}
        >
          <span className="sr-only">
            {row.unread ? "Unread. " : ""}
            {label}:{" "}
          </span>
          {row.href && row.viaHop ? (
            // The switch hop is a server route: a plain link, so it is a full load and never prefetched.
            <a
              href={row.href}
              data-row-link
              className="after:absolute after:inset-0 focus-visible:outline-none"
              onClick={() => actions.onOpened(row)}
            >
              {row.title}
            </a>
          ) : row.href ? (
            <Link
              href={row.href}
              data-row-link
              className="after:absolute after:inset-0 focus-visible:outline-none"
              onClick={() => actions.onOpened(row)}
            >
              {row.title}
            </Link>
          ) : (
            row.title
          )}
        </p>
        {row.message ? (
          <p className="line-clamp-2 text-lax-13 text-lax-muted md:truncate md:[display:block]">
            {row.message}
          </p>
        ) : null}
        <p className="mt-1.5 flex min-w-0 items-center gap-3">
          <AccountTag account={row.account} />
          {time("md:hidden")}
        </p>
      </div>
      <div className="relative z-10 flex shrink-0 items-center gap-1 md:gap-3">
        {time("hidden w-12 text-right md:block")}
        <InlineActionMenu label={`More for ${row.title}`} items={menu} />
      </div>
    </li>
  );
}
