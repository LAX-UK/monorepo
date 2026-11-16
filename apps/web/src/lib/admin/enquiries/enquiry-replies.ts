import { fileSize, threadTime } from "@/lib/admin/consignment-inbox/thread-view";
import type {
  EnquiryEmailReply,
  EnquiryView,
  InboundFile,
} from "@/lib/data/http/admin-enquiries.schema";
import { type FileMetadataItem, type ThreadItem, initialsOf } from "@auction/staff-ui";
import {
  AUTH_NOT_RECORDED,
  DKIM_LABELS,
  MATCHED_BY_LABELS,
  QUARANTINE_REASON_COPY,
  REPLIES_COPY,
  SPF_LABELS,
} from "./enquiry-email-copy";

const TYPE_WORDS: Readonly<Record<string, string>> = {
  "application/pdf": "PDF",
  "application/msword": "Word document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word document",
  "image/jpeg": "JPEG image",
  "image/png": "PNG image",
  "image/heic": "HEIC image",
  "image/gif": "GIF image",
  "image/webp": "WebP image",
  "text/plain": "Text file",
};

/** "JPEG image", "PDF", or the type's own subtype for anything else. */
export function fileTypeWord(contentType: string): string {
  const type = contentType.toLowerCase().split(";", 1)[0]?.trim() ?? "";
  if (TYPE_WORDS[type]) return TYPE_WORDS[type];
  if (type.startsWith("image/")) return "Image";
  const subtype = type.split("/")[1];
  return subtype ? `${subtype.toUpperCase()} file` : "File";
}

/** The metadata of the files an email named, as quiet rows with nothing to open. */
export function inboundFileItems(
  files: readonly InboundFile[],
  idPrefix: string,
): FileMetadataItem[] {
  return files.map((file, index) => ({
    id: `${idPrefix}-${index}`,
    name: file.name,
    detail: [fileTypeWord(file.contentType), fileSize(file.sizeBytes)].filter(Boolean).join(" · "),
    kind: file.contentType.toLowerCase().startsWith("image/") ? "image" : "document",
  }));
}

/**
 * How a reply staff attached from held email reads on the thread: "Attached by staff", or a
 * warning "Attached by staff · Sender not verified" with why it was held, whether it came from
 * another address, the sender checks and the reason given. Null for a reply that joined on its own.
 */
export function attachedProvenance(
  reply: EnquiryEmailReply,
): { label: string; tone: "neutral" | "warning"; details: string[] } | null {
  if (reply.matchedBy !== "staff") return null;
  const details: string[] = [];
  if (reply.heldReason) {
    details.push(REPLIES_COPY.heldBecause(QUARANTINE_REASON_COPY[reply.heldReason].label));
  }
  if (!reply.senderVerified) {
    if (reply.fromOtherAddress) details.push(REPLIES_COPY.otherAddress);
    details.push(
      REPLIES_COPY.senderChecks(
        reply.spfResult
          ? SPF_LABELS[reply.spfResult].toLowerCase()
          : AUTH_NOT_RECORDED.toLowerCase(),
        reply.dkimResult
          ? DKIM_LABELS[reply.dkimResult].toLowerCase()
          : AUTH_NOT_RECORDED.toLowerCase(),
      ),
    );
  }
  if (reply.reviewReason) details.push(REPLIES_COPY.reasonGiven(reply.reviewReason));
  return reply.senderVerified
    ? { label: REPLIES_COPY.attachedLabel, tone: "neutral", details }
    : { label: REPLIES_COPY.attachedUnverifiedLabel, tone: "warning", details };
}

function replyItem(reply: EnquiryEmailReply, clientName: string, now: Date): ThreadItem {
  return {
    type: "message",
    id: `reply-${reply.id}`,
    author: {
      name: clientName,
      initials: initialsOf(clientName),
      role: REPLIES_COPY.clientRole,
      side: "client",
    },
    channel: REPLIES_COPY.channel,
    time: threadTime(reply.receivedAt, now),
    body: reply.body,
    attachments: [],
    files: inboundFileItems(reply.attachments, reply.id),
    filesNote: REPLIES_COPY.filesNote,
    provenance: attachedProvenance(reply),
  };
}

/**
 * The client's emailed replies as thread messages, oldest first: plain text, the "via email"
 * label, and the names of any files without links (the files were never kept).
 */
export function replyThreadItems(enquiry: EnquiryView, now: Date): ThreadItem[] {
  return enquiry.replies.map((reply) => replyItem(reply, enquiry.name, now));
}

/** How the reply joined the thread, for its timeline entry; says so when the sender is not verified. */
export function replyMatchDetail(reply: EnquiryEmailReply): string {
  if (reply.matchedBy === "staff" && !reply.senderVerified) {
    return `${MATCHED_BY_LABELS.staff} · ${REPLIES_COPY.senderNotVerified}`;
  }
  return MATCHED_BY_LABELS[reply.matchedBy];
}
