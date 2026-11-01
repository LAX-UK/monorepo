import { MemberInitials } from "@/components/legal-entity/members/member-initials";
import type { MessageRowView } from "@/lib/seller/consignment-thread";
import { cn } from "@auction/ui";
import { FileAttachment } from "@auction/ui/lax";
import type { ReactNode } from "react";

/**
 * The bubble every message sits in, as wide as its text up to a reading line: the account's own
 * on the selected tint, LAX's on the sunken one.
 */
export function MessageBubble({ mine, children }: { mine: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "w-fit max-w-[72ch] rounded-lax-card rounded-tl-[4px] px-3.5 py-2.5 text-lax-14 leading-5 text-lax-fg",
        mine ? "bg-lax-selected" : "bg-lax-sunken",
      )}
    >
      {children}
    </div>
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
            <ul aria-label="Files" className={cn("flex flex-col gap-2", row.body ? "mt-2" : null)}>
              {row.attachments.map((file) => (
                <li key={file.id} className="max-w-full">
                  <FileAttachment
                    name={file.fileName}
                    href={file.url}
                    kind={file.kind}
                    size={file.size}
                    thumbnailUrl={file.kind === "image" ? file.url : null}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </MessageBubble>
      </div>
    </li>
  );
}
