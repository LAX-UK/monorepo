"use client";

import { REPLIES_COPY } from "@/lib/admin/enquiries/enquiry-email-copy";
import { replyThreadItems } from "@/lib/admin/enquiries/enquiry-replies";
import type { EnquiryView } from "@/lib/data/http/admin-enquiries.schema";
import { MessageThread, Section, StatusBadge, formatStaffDateTime } from "@auction/staff-ui";

/**
 * The client's emailed replies on the record: each as a client message labelled "via email", in
 * plain text, with the names of any files and no way to open them (only their names were kept).
 */
export function EnquiryRepliesSection({ enquiry, now }: { enquiry: EnquiryView; now: Date }) {
  const items = replyThreadItems(enquiry, now);
  return (
    <Section
      id="replies"
      title={REPLIES_COPY.sectionTitle}
      description={REPLIES_COPY.sectionDescription}
    >
      <MessageThread
        items={items}
        label={REPLIES_COPY.logLabel(enquiry.name)}
        jumpToLatest={false}
        className="px-0 py-0"
        empty={<p className="m-0 text-left text-staff-sm text-staff-muted">{REPLIES_COPY.empty}</p>}
      />
    </Section>
  );
}

/** "Client replied": the thread waits for an answer since the client's latest unanswered reply. */
export function AwaitingReplyBadge({ since, now }: { since: string | null; now: Date }) {
  if (!since) return null;
  return (
    <StatusBadge tone="warning" shape="dot">
      {REPLIES_COPY.awaitingBadge}
      <span className="sr-only">
        . {REPLIES_COPY.awaitingDescription(formatStaffDateTime(since, now))}
      </span>
    </StatusBadge>
  );
}
