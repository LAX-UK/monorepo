"use client";

import type { NeedsYouRowView, NeedsYouTopic } from "@/lib/organisation-home/needs-you-view";
import type { HomeNoticeView } from "@/lib/organisation-home/organisation-home-view";
import { Button, Dialog, StatusBadge } from "@auction/ui/lax";
import {
  Building2,
  CircleCheck,
  Gavel,
  type LucideIcon,
  Package,
  Receipt,
  Truck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HomeNotices } from "./home-notices";
import { HomePanel, HomeSection } from "./home-section";

/** Rows shown before "View all"; the rest are one press away, never cut silently. */
export const NEEDS_YOU_VISIBLE = 5;

const TOPIC_ICON: Record<NeedsYouTopic, LucideIcon> = {
  bid: Gavel,
  purchase: Receipt,
  delivery: Truck,
  consignment: Package,
  team: Users,
  account: Building2,
};

type Props = {
  rows: readonly NeedsYouRowView[];
  /** The reader did not answer: say so and offer to try again, never "nothing needs you". */
  failed: boolean;
  notices: readonly HomeNoticeView[];
};

function DueBadge({ due }: { due: NonNullable<NeedsYouRowView["due"]> }) {
  return (
    <StatusBadge tone={due.tone} shape="alert">
      <time dateTime={due.dateTime}>{due.text}</time>
    </StatusBadge>
  );
}

function NeedsYouRow({ row }: { row: NeedsYouRowView }) {
  const Icon = TOPIC_ICON[row.topic];
  return (
    <li
      className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 border-t border-lax-line-subtle px-4 py-3 first:border-t-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-4 sm:pr-4 sm:pl-5"
      data-testid={`home-task-${row.key}`}
    >
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center self-start rounded-lax-badge bg-lax-paper text-lax-muted sm:self-center"
      >
        <Icon className="size-5" strokeWidth={1.5} />
      </span>
      <span className="min-w-0">
        <span className="block text-lax-14 font-medium text-pretty text-lax-fg">{row.title}</span>
        <span className="mt-0.5 line-clamp-2 block text-lax-13 text-lax-muted sm:line-clamp-1">
          {row.detail}
        </span>
        {row.due ? (
          <span className="mt-1.5 block sm:hidden">
            <DueBadge due={row.due} />
          </span>
        ) : null}
      </span>
      <span className="col-start-2 flex items-center gap-3 sm:col-start-3">
        {row.due ? (
          <span className="hidden sm:inline-flex">
            <DueBadge due={row.due} />
          </span>
        ) : null}
        <Button
          asChild
          variant="secondary"
          className="h-11 w-full sm:h-lax-control-md sm:w-auto sm:min-w-24"
        >
          <Link href={row.action.href}>{row.action.label}</Link>
        </Button>
      </span>
    </li>
  );
}

function HowThisListWorks() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        className="h-auto px-0 text-lax-14 font-medium underline in-data-[lax-density=client]:px-0 decoration-lax-line-strong underline-offset-4 hover:bg-transparent hover:decoration-current active:bg-transparent"
        onClick={() => setOpen(true)}
      >
        How this list works
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="How this list works"
        description="Everything that waits on you for this account, in one list."
      >
        <ol className="list-decimal space-y-1 pl-5 text-lax-14 text-lax-fg">
          <li>Lots you've been outbid on, while they're still open</li>
          <li>Money and dates: purchases to pay and choices due soon</li>
          <li>Agreements to accept and changes a specialist asked for</li>
          <li>Delivery, collection and the rest of the work</li>
          <li>Setting up the account</li>
        </ol>
        <p className="mt-4 text-lax-14 text-lax-muted">
          A task leaves the list once it's done. The numbers beside Bids, Purchases, Consignments
          and Team in the menu count the same things.
        </p>
      </Dialog>
    </>
  );
}

function Failed() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <HomePanel className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <output className="text-lax-14 text-lax-fg">
        We couldn't load what needs you. Your counts in the menu may be out of date too.
      </output>
      <Button
        variant="secondary"
        loading={pending}
        className="h-11 sm:h-lax-control-md"
        onClick={() => startTransition(() => router.refresh())}
      >
        Try again
      </Button>
    </HomePanel>
  );
}

/**
 * "Needs you", from the one reader: one row per task with what to do, about what and for whom,
 * the date when there is one, and one button. Outbid first, then money and time, then binding
 * steps, then setup. Five show; the rest are behind "View all". With nothing left it is one calm
 * line, never an empty card. Notices follow as information, never as tasks.
 */
export function HomeNeedsYou({ rows, failed, notices }: Props) {
  const [all, setAll] = useState(false);
  if (failed) {
    return (
      <HomeSection id="home-needs-you" title="Needs you">
        <Failed />
      </HomeSection>
    );
  }
  if (rows.length === 0) {
    return (
      <section aria-label="Needs you" className="space-y-3">
        <p
          className="flex items-center gap-2 text-lax-14 text-lax-muted"
          data-testid="home-needs-you-empty"
        >
          <CircleCheck
            className="size-4 shrink-0 text-lax-success-fg"
            strokeWidth={1.75}
            aria-hidden
          />
          Nothing needs you right now.
        </p>
        <HomeNotices notices={notices} />
      </section>
    );
  }
  const shown = all ? rows : rows.slice(0, NEEDS_YOU_VISIBLE);
  const hidden = rows.length - shown.length;
  return (
    <HomeSection id="home-needs-you" title="Needs you" end={<HowThisListWorks />}>
      <HomePanel>
        <ul aria-labelledby="home-needs-you" id="home-needs-you-list">
          {shown.map((row) => (
            <NeedsYouRow key={row.key} row={row} />
          ))}
        </ul>
        {hidden > 0 ? (
          <div className="border-t border-lax-line-subtle px-2 py-1">
            <Button
              variant="ghost"
              aria-controls="home-needs-you-list"
              aria-expanded={false}
              className="h-11 w-full sm:h-lax-control-md"
              onClick={() => setAll(true)}
            >
              View all {rows.length}
            </Button>
          </div>
        ) : null}
      </HomePanel>
      <HomeNotices notices={notices} className="mt-3" />
    </HomeSection>
  );
}
