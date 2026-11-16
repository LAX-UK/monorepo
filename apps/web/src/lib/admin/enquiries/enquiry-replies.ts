import { fileSize, threadTime } from "@/lib/admin/consignment-inbox/thread-view";
import type {
  EnquiryEmailReply,
  EnquiryView,
  InboundFile,
} from "@/lib/data/http/admin-enquiries.schema";
import { type FileMetadataItem, type ThreadItem, initialsOf } from "@auction/staff-ui";
import { MATCHED_BY_LABELS, REPLIES_COPY } from "./enquiry-email-copy";

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
  };
}

/**
 * The client's emailed replies as thread messages, oldest first: plain text, the "via email"
 * label, and the names of any files without links (the files were never kept).
 */
export function replyThreadItems(enquiry: EnquiryView, now: Date): ThreadItem[] {
  return enquiry.replies.map((reply) => replyItem(reply, enquiry.name, now));
}

/** How the reply joined the thread, for its timeline entry. */
export function replyMatchDetail(reply: EnquiryEmailReply): string {
  return MATCHED_BY_LABELS[reply.matchedBy];
}
