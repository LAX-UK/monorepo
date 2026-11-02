"use client";

import { TOPIC_ICON } from "@/components/organisation-home/home-needs-you";
import type { InboxAccountTag } from "@/lib/notifications/inbox-row.vm";
import type { NeedsYouRowView } from "@/lib/organisation-home/needs-you-view";
import { cn } from "@auction/ui";
import { Button, StatusBadge } from "@auction/ui/lax";
import Link from "next/link";
import { AccountTag } from "./notification-row";

function Due({ due }: { due: NonNullable<NeedsYouRowView["due"]> }) {
  return (
    <StatusBadge tone={due.tone} shape="alert">
      <time dateTime={due.dateTime}>{due.text}</time>
    </StatusBadge>
  );
}

/**
 * One thing that needs the person, laid out as a notification: what it is about, what to do, the
 * account it is for and the date when there is one, with its single action. A task waits until it
 * is done, so it keeps the unread mark (a bar and a bolder title) for as long as it is listed.
 */
export function NeedsActionRow({
  row,
  account,
}: {
  row: NeedsYouRowView;
  account: InboxAccountTag;
}) {
  const Icon = TOPIC_ICON[row.topic];
  return (
    <li
      data-testid={`needs-action-${row.key}`}
      className={cn(
        "relative flex min-h-[72px] flex-col gap-3 py-3 pr-3 pl-4 md:min-h-16 md:flex-row md:items-center md:gap-4 md:pl-5",
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-lax-fg",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3 md:items-center md:gap-4">
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-lax-control bg-lax-sunken text-lax-muted shadow-[inset_0_0_0_1px_var(--lax-line)]"
        >
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lax-14 font-semibold text-pretty text-lax-fg">
            <span className="sr-only">Needs action: </span>
            {row.title}
          </p>
          <p className="line-clamp-2 text-lax-13 text-lax-muted md:line-clamp-1">{row.detail}</p>
          <p className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <AccountTag account={account} />
            {row.due ? (
              <span className="md:hidden">
                <Due due={row.due} />
              </span>
            ) : null}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {row.due ? (
          <span className="hidden md:inline-flex">
            <Due due={row.due} />
          </span>
        ) : null}
        <Button
          asChild
          variant="secondary"
          className="h-11 w-full md:h-lax-control-md md:w-auto md:min-w-24"
        >
          <Link href={row.action.href}>{row.action.label}</Link>
        </Button>
      </div>
    </li>
  );
}
