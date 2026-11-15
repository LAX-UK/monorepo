"use client";

import { enquiryAttachmentLinkAction } from "@/lib/actions/admin/admin-enquiries";
import type { EnquiryView } from "@/lib/data/http/admin-enquiries.schema";
import { notify } from "@/lib/ui/notify";
import { Section, StaffButton } from "@auction/staff-ui";
import { ExternalLink, FileText, Image as ImageIcon } from "@auction/staff-ui/icons";
import { useState } from "react";

type Attachment = EnquiryView["attachments"][number];

/** "Photo 2 of 3", "Document 1": what the client sent, in the order they sent it. */
export function attachmentName(attachment: Attachment, all: readonly Attachment[]): string {
  const same = all.filter((a) => a.kind === attachment.kind);
  const noun = attachment.kind === "image" ? "Photo" : "Document";
  const index = same.findIndex((a) => a.id === attachment.id) + 1;
  return same.length > 1 ? `${noun} ${index} of ${same.length}` : noun;
}

/**
 * The files the client attached. Each opens through a link the server signs when it is clicked and
 * that lapses within a minute, so a file is never reachable at an address that outlives the click.
 */
export function AttachmentsSection({
  reference,
  attachments,
}: { reference: string; attachments: Attachment[] }) {
  const [opening, setOpening] = useState<string | null>(null);
  if (attachments.length === 0) return null;

  async function open(attachment: Attachment) {
    setOpening(attachment.id);
    const result = await enquiryAttachmentLinkAction(reference, attachment.id);
    setOpening(null);
    if (!result.ok || !result.data) {
      notify.error(result.ok ? "This file couldn't be opened." : result.error);
      return;
    }
    const link = document.createElement("a");
    link.href = result.data.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  }

  return (
    <Section
      id="attachments"
      title="Attachments"
      description="Opened with a link that expires within a minute. Each time a file is opened is recorded in the Audit log."
    >
      <ul className="divide-y divide-staff-line-subtle">
        {attachments.map((attachment) => (
          <li key={attachment.id} className="flex items-center justify-between gap-3 py-2">
            <span className="inline-flex min-w-0 items-center gap-2 text-staff-sm">
              {attachment.kind === "image" ? (
                <ImageIcon aria-hidden className="size-4 shrink-0 text-staff-muted" />
              ) : (
                <FileText aria-hidden className="size-4 shrink-0 text-staff-muted" />
              )}
              <span className="truncate">{attachmentName(attachment, attachments)}</span>
            </span>
            <StaffButton
              size="sm"
              variant="secondary"
              icon={<ExternalLink aria-hidden />}
              loading={opening === attachment.id}
              aria-label={`Open ${attachmentName(attachment, attachments)}`}
              onClick={() => void open(attachment)}
            >
              Open
            </StaffButton>
          </li>
        ))}
      </ul>
    </Section>
  );
}
