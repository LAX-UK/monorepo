import { fileSize } from "@/lib/admin/consignment-inbox/thread-view";
import {
  CONSIGNMENT_MESSAGE_ATTACHMENT_MAX_BYTES,
  CONSIGNMENT_MESSAGE_ATTACHMENT_TYPES,
  CONSIGNMENT_MESSAGE_MAX_ATTACHMENTS,
  CONSIGNMENT_MESSAGE_MAX_LENGTH,
} from "@auction/domain";

/**
 * The staff composer's files and Send rules. A file the rules refuse stays in the box as a red
 * chip with its reason, and Send stays available for the rest: a rejected file never blocks a
 * reply, it is simply not sent.
 */

export type StaffComposerFile = {
  id: string;
  name: string;
  kind: "image" | "pdf";
  size: string | null;
  status: "uploading" | "ready" | "rejected";
  progress: number | null;
  uploadObjectId: string | null;
  /** Why it will not be sent: "32 MB, the limit is 15 MB". */
  error: string | null;
};

const MAX_MB = Math.round(CONSIGNMENT_MESSAGE_ATTACHMENT_MAX_BYTES / (1024 * 1024));
const TYPES = new Set<string>(CONSIGNMENT_MESSAGE_ATTACHMENT_TYPES);
export const ACCEPTED_FILE_TYPES = CONSIGNMENT_MESSAGE_ATTACHMENT_TYPES.join(",");

function extension(name: string): string {
  const ext = name.split(".").pop();
  return ext && ext !== name ? ext.toUpperCase() : "This file type";
}

/** Why a file cannot be attached, in the words the chip shows; null when it can. */
export function fileProblem(file: { name: string; type: string; size: number }): string | null {
  const wrongType = !TYPES.has(file.type);
  const tooBig = file.size > CONSIGNMENT_MESSAGE_ATTACHMENT_MAX_BYTES;
  if (wrongType && tooBig) {
    return `${fileSize(file.size)} and ${extension(file.name)} isn’t accepted`;
  }
  if (wrongType) return `${extension(file.name)} isn’t accepted, use JPG, PNG, WebP or PDF`;
  if (tooBig) return `${fileSize(file.size)}, the limit is ${MAX_MB} MB`;
  if (file.size <= 0) return "The file is empty";
  return null;
}

/** The sentence under the box naming every refused file and what is accepted. */
export function attachmentErrorSentence(files: readonly StaffComposerFile[]): string | null {
  const rejected = files.filter((file) => file.status === "rejected");
  if (rejected.length === 0) return null;
  const names = rejected.map((file) => `${file.name} (${file.error})`).join("; ");
  return `${names}. Send goes without ${rejected.length === 1 ? "it" : "them"}. Photos (JPG, PNG, WebP) or PDFs, up to ${MAX_MB} MB each.`;
}

export function attachBlockedReason(files: readonly StaffComposerFile[]): string | null {
  const attached = files.filter((file) => file.status !== "rejected").length;
  return attached >= CONSIGNMENT_MESSAGE_MAX_ATTACHMENTS
    ? `Up to ${CONSIGNMENT_MESSAGE_MAX_ATTACHMENTS} files on one message`
    : null;
}

/** Why Send is off, or null. Rejected files are left behind, not blocking. */
export function sendBlockedReason(
  body: string,
  files: readonly StaffComposerFile[],
): string | null {
  if (files.some((file) => file.status === "uploading")) return "Wait until the files are checked";
  const words = body.trim().length;
  if (words > CONSIGNMENT_MESSAGE_MAX_LENGTH) {
    return `Keep the message under ${CONSIGNMENT_MESSAGE_MAX_LENGTH.toLocaleString("en-GB")} characters`;
  }
  if (words === 0 && !files.some((file) => file.status === "ready")) {
    return "Write a message or attach a file";
  }
  return null;
}

/** The ready files, as the API takes them. */
export function readyAttachments(files: readonly StaffComposerFile[]) {
  return files.flatMap((file) =>
    file.status === "ready" && file.uploadObjectId
      ? [{ uploadObjectId: file.uploadObjectId, fileName: file.name }]
      : [],
  );
}
