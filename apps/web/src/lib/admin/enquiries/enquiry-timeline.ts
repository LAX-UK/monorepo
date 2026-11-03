import type { EnquiryView } from "@/lib/data/http/admin-enquiries.schema";
import type { TimelineEvent } from "@auction/staff-ui";
import { ENQUIRY_CLOSE_REASON_LABELS } from "./enquiries.vm";

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** What was attached, in words: "2 photos and 1 document". */
export function attachmentSummary(attachments: EnquiryView["attachments"]): string | null {
  const photos = attachments.filter((a) => a.kind === "image").length;
  const documents = attachments.length - photos;
  const parts = [
    photos ? plural(photos, "photo", "photos") : null,
    documents ? plural(documents, "document", "documents") : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" and ") : null;
}

/**
 * The record's own history, newest first: when it arrived, each note, and how it ended. Who
 * assigned it and every status change are domain events and appear in the Audit log.
 */
export function enquiryTimeline(
  enquiry: EnquiryView,
  nameOf: (userId: string | null) => string | undefined,
): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: "received",
      title: enquiry.userId ? "Received from a signed-in client" : "Received from a guest",
      at: enquiry.receivedAt,
      ...(attachmentSummary(enquiry.attachments)
        ? { detail: attachmentSummary(enquiry.attachments) }
        : {}),
    },
    ...enquiry.notes.map((note) => {
      const actor = nameOf(note.authorUserId);
      return {
        id: `note-${note.id}`,
        title: "Note added",
        at: note.createdAt,
        ...(actor ? { actor } : {}),
      };
    }),
  ];
  if (enquiry.handledAt && (enquiry.status === "closed" || enquiry.status === "converted")) {
    events.push({
      id: "ended",
      title:
        enquiry.status === "converted"
          ? "Converted to a deal"
          : enquiry.closeReason
            ? `Closed: ${ENQUIRY_CLOSE_REASON_LABELS[enquiry.closeReason]}`
            : "Closed",
      at: enquiry.handledAt,
      tone: enquiry.status === "converted" ? "success" : "neutral",
    });
  }
  return events.sort((a, b) => b.at.localeCompare(a.at));
}
