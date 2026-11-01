import { MemberInitials } from "@/components/legal-entity/members/member-initials";
import type { MessageRowView } from "@/lib/seller/consignment-thread";
import { cn } from "@auction/ui";
import { FileText, ImageIcon } from "lucide-react";
import type { ReactNode } from "react";

/** The bubble every message sits in: the account's own on the selected tint, LAX's sunken. */
export function MessageBubble({ mine, children }: { mine: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-lax-card rounded-tl-[4px] px-3.5 py-2.5 text-lax-14 leading-5 text-lax-fg",
        mine ? "bg-lax-selected" : "bg-lax-sunken",
      )}
    >
      {children}
    </div>
  );
}

/** One file on a message: its icon, name and size, opening in a new tab. */
function AttachmentLine({ file }: { file: MessageRowView["attachments"][number] }) {
  const Icon = file.kind === "pdf" ? FileText : ImageIcon;
  return (
    <li>
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-w-full items-center gap-1.5 rounded-lax-control text-lax-13 leading-5 text-lax-muted underline-offset-4 hover:text-lax-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lax-focus"
      >
        <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
        <span className="truncate">{file.fileName}</span>
        {file.size ? <span className="shrink-0">· {file.size}</span> : null}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </li>
  );
}

/** A message in the thread: who wrote it and when, the words, and any files. */
export function ConsignmentMessageItem({ row }: { row: MessageRowView }) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
      <MemberInitials>{row.initials}</MemberInitials>
      <div className="min-w-0">
        <p className="mb-1 text-lax-12 leading-4 text-lax-muted">
          {row.who} ·{" "}
          <time dateTime={row.dateTime} title={row.fullTime}>
            {row.time}
          </time>
        </p>
        <MessageBubble mine={row.mine}>
          {row.body ? <p className="break-words whitespace-pre-line">{row.body}</p> : null}
          {row.attachments.length > 0 ? (
            <ul className={cn("flex flex-col gap-1", row.body ? "mt-2" : null)}>
              {row.attachments.map((file) => (
                <AttachmentLine key={file.id} file={file} />
              ))}
            </ul>
          ) : null}
        </MessageBubble>
      </div>
    </li>
  );
}
