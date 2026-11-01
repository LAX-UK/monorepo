import { initials } from "@/components/organisations/initials";
import {
  type ConsignmentThread as Thread,
  messageRows,
  threadCounterpart,
} from "@/lib/seller/consignment-thread";
import { ButtonLink } from "@auction/ui/lax";
import { Lock, MessageSquare } from "lucide-react";
import Link from "next/link";
import { ConsignmentMessageComposer } from "./consignment-message-composer";
import { ConsignmentMessageItem } from "./consignment-message-item";
import { ConsignmentThreadRefresh } from "./consignment-thread-refresh";

type Props = {
  submissionId: string;
  /** `null` when the thread could not be read. */
  thread: Thread | null;
  viewerName: string;
  /** Where "Try again" leads: this tab again. */
  retryHref: string;
  now: Date;
};

const CARD = "flex flex-col rounded-lax-card border border-lax-line bg-lax-surface";
const HEADING = "font-lax-display text-lax-18 font-semibold text-lax-fg";

/**
 * The consignment's messages with its specialist, drawn on the server: the thread oldest first,
 * then the composer for the people who may write, or the reason they cannot. The composer and
 * the refresh are the only parts that run in the browser.
 */
export function ConsignmentThread({ submissionId, thread, viewerName, retryHref, now }: Props) {
  if (!thread) {
    return (
      <section aria-labelledby="messages-heading" className={CARD}>
        <div className="px-4 pt-5 pb-6 sm:px-6">
          <h2 id="messages-heading" className={HEADING}>
            Messages
          </h2>
          <p className="mt-2 text-lax-14 leading-6 text-lax-muted">
            We couldn't load the messages. Your messages are safe; try again in a moment.
          </p>
          <ButtonLink href={retryHref} Link={Link} className="mt-4">
            Try again
          </ButtonLink>
        </div>
      </section>
    );
  }

  const counterpart = threadCounterpart(thread);
  const rows = messageRows(thread.messages, now);
  return (
    <section aria-labelledby="messages-heading" className={CARD}>
      <ConsignmentThreadRefresh submissionId={submissionId} markRead unread={thread.unread} />
      <div className="px-4 pt-5 pb-4 sm:px-6">
        <h2 id="messages-heading" className={HEADING}>
          {counterpart.heading}
        </h2>
      </div>
      {rows.length > 0 ? (
        <ol aria-label="Messages" className="flex flex-col gap-4 px-4 sm:px-6">
          {rows.map((row) => (
            <ConsignmentMessageItem key={row.id} row={row} />
          ))}
        </ol>
      ) : (
        <div className="mx-4 flex items-start gap-3 rounded-lax-card bg-lax-sunken px-4 py-4 sm:mx-6">
          <MessageSquare
            aria-hidden
            className="mt-0.5 size-5 shrink-0 text-lax-muted"
            strokeWidth={1.75}
          />
          <p className="text-lax-14 leading-5 text-lax-fg">{counterpart.empty}</p>
        </div>
      )}
      {thread.access.canWrite ? (
        <ConsignmentMessageComposer
          submissionId={submissionId}
          placeholder={counterpart.placeholder}
          viewer={{ name: viewerName, initials: initials(viewerName) }}
        />
      ) : (
        <p className="mt-4 flex items-start gap-2 border-t border-lax-line-subtle px-4 pt-4 pb-5 text-lax-13 leading-5 text-lax-muted sm:px-6">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          <span>{thread.access.reason ?? "You can read these messages."}</span>
        </p>
      )}
    </section>
  );
}
