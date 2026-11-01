import {
  CONSIGNMENT_MESSAGE_ATTACHMENT_MAX_BYTES,
  CONSIGNMENT_MESSAGE_ATTACHMENT_TYPES,
  CONSIGNMENT_MESSAGE_MAX_ATTACHMENTS,
  CONSIGNMENT_MESSAGE_MAX_LENGTH,
} from "@auction/domain";

/** A file picked for the next message, while it uploads and is checked. */
export type ComposerFile = {
  id: string;
  name: string;
  status: "uploading" | "ready" | "failed";
  uploadObjectId: string | null;
};

/** A message on its way, or one that could not be sent and waits for Retry. */
export type PendingMessage = {
  id: string;
  body: string;
  files: Array<{ uploadObjectId: string; name: string }>;
  status: "sending" | "failed";
  error: string | null;
};

export type ComposerSendState = {
  canSend: boolean;
  /** Why Send is off, when it is. */
  sendBlockedReason: string | null;
  canAttach: boolean;
  attachBlockedReason: string | null;
  /** The line under the box: what is happening, or how to send. */
  hint: string;
};

const MAX_MB = Math.round(CONSIGNMENT_MESSAGE_ATTACHMENT_MAX_BYTES / (1024 * 1024));
const TYPES = new Set<string>(CONSIGNMENT_MESSAGE_ATTACHMENT_TYPES);

/** Whether the message can go now, and the words that say why not. */
export function composerSendState(input: {
  body: string;
  files: readonly ComposerFile[];
}): ComposerSendState {
  const uploading = input.files.some((f) => f.status === "uploading");
  const failed = input.files.some((f) => f.status === "failed");
  const ready = input.files.some((f) => f.status === "ready");
  const words = input.body.trim().length;
  const tooLong = words > CONSIGNMENT_MESSAGE_MAX_LENGTH;
  const full = input.files.length >= CONSIGNMENT_MESSAGE_MAX_ATTACHMENTS;
  const sendBlockedReason = uploading
    ? "Wait until the files are checked"
    : failed
      ? "Remove the file that could not be attached"
      : tooLong
        ? `Keep the message under ${CONSIGNMENT_MESSAGE_MAX_LENGTH.toLocaleString("en-GB")} characters`
        : words === 0 && !ready
          ? "Write a message or attach a file"
          : null;
  return {
    canSend: sendBlockedReason === null,
    sendBlockedReason,
    canAttach: !full,
    attachBlockedReason: full
      ? `Up to ${CONSIGNMENT_MESSAGE_MAX_ATTACHMENTS} files on one message`
      : null,
    hint: uploading
      ? "Checking the files before they can be sent…"
      : failed
        ? "A file could not be attached. Remove it and try again."
        : `Photos or PDFs up to ${MAX_MB} MB each.`,
  };
}

/** The picked files that can be attached, and what was wrong with the rest. */
export function pickAttachableFiles(
  picked: readonly File[],
  alreadyAttached: number,
): { accepted: File[]; problem: string | null } {
  const room = Math.max(0, CONSIGNMENT_MESSAGE_MAX_ATTACHMENTS - alreadyAttached);
  const fitting = picked.filter(
    (file) =>
      TYPES.has(file.type) &&
      file.size > 0 &&
      file.size <= CONSIGNMENT_MESSAGE_ATTACHMENT_MAX_BYTES,
  );
  const accepted = fitting.slice(0, room);
  const problem =
    fitting.length < picked.length
      ? `Only photos (JPEG, PNG, WebP) or PDFs up to ${MAX_MB} MB can be attached.`
      : accepted.length < fitting.length
        ? `Up to ${CONSIGNMENT_MESSAGE_MAX_ATTACHMENTS} files on one message.`
        : null;
  return { accepted, problem };
}
