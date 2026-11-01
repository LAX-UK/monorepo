import type { ConsignmentEventKind, ConsignmentEventView } from "@/lib/seller/consignment-history";
import { PAYOUT_READERS } from "@/lib/seller/payout-readers";
import { Notice } from "@auction/ui/lax";
import {
  Banknote,
  BookOpen,
  CircleCheck,
  CircleSlash,
  FileCheck2,
  FilePen,
  FileText,
  Gavel,
  type LucideIcon,
  MessageSquare,
  PencilLine,
  Send,
  Undo2,
  XCircle,
} from "lucide-react";

/** One icon per kind of event, so a new kind is a new row here. */
const EVENT_ICON: Record<ConsignmentEventKind, LucideIcon> = {
  started: FilePen,
  sent: Send,
  changes: PencilLine,
  reviewed: CircleCheck,
  declined: XCircle,
  agreement_sent: FileText,
  agreement_accepted: FileCheck2,
  catalogued: BookOpen,
  sale_opened: Gavel,
  sold: CircleCheck,
  unsold: CircleSlash,
  choice: Undo2,
  withdrawal: Undo2,
  paid_out: Banknote,
  message: MessageSquare,
};

type Props = {
  events: readonly ConsignmentEventView[];
  /** The messages could not be read, so they are missing from the list. */
  messagesMissing: boolean;
  /** The work sold and its payout is not shown to this member: say so rather than leave it out. */
  payoutsHidden: boolean;
};

const CARD = "rounded-lax-card border border-lax-line bg-lax-surface";

/**
 * The consignment's History tab: what happened, newest first, from submission to payout, with
 * the messages in their place. Each step is a line with its icon, what happened, who did it or
 * what was said, and when.
 */
export function ConsignmentHistoryTab({ events, messagesMissing, payoutsHidden }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {messagesMissing ? (
        <Notice tone="warning" title="Messages are missing from this history">
          We couldn't load them just now. Everything else is here; reload the page to try again.
        </Notice>
      ) : null}
      <section aria-labelledby="history-heading" className={CARD}>
        <h2
          id="history-heading"
          className="px-4 pt-5 pb-4 font-lax-display text-lax-18 font-semibold text-lax-fg sm:px-6"
        >
          History
        </h2>
        <ol aria-label="What happened, newest first" className="px-4 pb-5 sm:px-6">
          {events.map((event, index) => {
            const Icon = EVENT_ICON[event.kind];
            const last = index === events.length - 1;
            return (
              <li key={event.id} className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
                {last ? null : (
                  <span
                    aria-hidden
                    className="absolute top-9 bottom-1 left-4 w-px -translate-x-1/2 bg-lax-line"
                  />
                )}
                <span
                  aria-hidden
                  className="grid size-8 place-items-center rounded-full bg-lax-sunken text-lax-muted"
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <div className={last ? "min-w-0 pt-1" : "min-w-0 pt-1 pb-5"}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p className="text-lax-14 leading-5 font-medium text-lax-fg">{event.title}</p>
                    <time
                      dateTime={event.dateTime}
                      title={event.fullTime}
                      className="text-lax-12 leading-4 text-lax-muted tabular-nums"
                    >
                      {event.time}
                    </time>
                  </div>
                  {event.detail ? (
                    <p className="mt-0.5 text-lax-13 leading-5 break-words text-lax-muted">
                      {event.detail}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
        {payoutsHidden ? (
          <p className="border-t border-lax-line-subtle px-4 py-4 text-lax-13 leading-5 text-lax-muted sm:px-6">
            Only {PAYOUT_READERS} sees when the money is paid out.
          </p>
        ) : null}
      </section>
    </div>
  );
}
