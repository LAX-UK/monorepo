import type { EnquiryHistoryEntry, EnquiryView } from "@/lib/data/http/admin-enquiries.schema";
import type { TimelineEvent } from "@auction/staff-ui";
import { ENQUIRY_CLOSE_REASON_LABELS, ENQUIRY_STATUS_LABELS } from "./enquiries.vm";
import { MATCHED_BY_LABELS, REPLIES_COPY } from "./enquiry-email-copy";

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

function labelled<T extends string>(table: Record<T, string>, key: string | null): string | null {
  return key !== null && key in table ? table[key as T] : null;
}

/** Said when the directory cannot name someone, rather than guessing they have left. */
const NEUTRAL_STAFF_NAME = "Another staff member";

/** One audit trail entry in words: who was handed the enquiry, or where its status went. */
function historyEvent(
  entry: EnquiryHistoryEntry,
  nameOf: (userId: string | null) => string | undefined,
): TimelineEvent {
  const named = (userId: string | null, name: string | null) =>
    userId ? (name ?? nameOf(userId) ?? NEUTRAL_STAFF_NAME) : null;
  const actor = named(entry.actorUserId, entry.actorName);
  const common = { id: `audit-${entry.id}`, at: entry.at, ...(actor ? { actor } : {}) };
  if (entry.kind === "assigned") {
    const mid = (name: string | null) =>
      name === NEUTRAL_STAFF_NAME ? NEUTRAL_STAFF_NAME.toLowerCase() : name;
    const to = mid(named(entry.toUserId, entry.toName));
    const from = mid(named(entry.fromUserId, entry.fromName));
    return {
      ...common,
      title: to ? `Assigned to ${to}` : "Unassigned",
      ...(from ? { detail: `Previously ${from}` } : {}),
    };
  }
  if (entry.kind === "converted") {
    return { ...common, title: "Converted to a deal", tone: "success" };
  }
  const to = labelled(ENQUIRY_STATUS_LABELS, entry.to);
  const reason = labelled(ENQUIRY_CLOSE_REASON_LABELS, entry.closeReason);
  return {
    ...common,
    title:
      entry.to === "closed"
        ? `Closed${reason ? `: ${reason}` : ""}`
        : `Status changed to ${(to ?? entry.to ?? "another status").toLowerCase()}`,
    ...(labelled(ENQUIRY_STATUS_LABELS, entry.from)
      ? { detail: `From ${labelled(ENQUIRY_STATUS_LABELS, entry.from)?.toLowerCase()}` }
      : {}),
  };
}

/**
 * The record's history, newest first: when it arrived, each note, each emailed reply from the
 * client, and every assignment and status change from the audit trail. Without the trail (it could not be read) the record's own end
 * stands in for the close or conversion.
 */
export function enquiryTimeline(
  enquiry: EnquiryView,
  nameOf: (userId: string | null) => string | undefined,
  history: readonly EnquiryHistoryEntry[] | null = null,
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
    ...enquiry.replies.map(
      (reply): TimelineEvent => ({
        id: `reply-${reply.id}`,
        title:
          reply.matchedBy === "staff" ? REPLIES_COPY.timelineAttached : REPLIES_COPY.timelineEvent,
        at: reply.receivedAt,
        detail: MATCHED_BY_LABELS[reply.matchedBy],
        tone: "info",
      }),
    ),
  ];
  if (history) events.push(...history.map((entry) => historyEvent(entry, nameOf)));
  if (
    !history &&
    enquiry.handledAt &&
    (enquiry.status === "closed" || enquiry.status === "converted")
  ) {
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
