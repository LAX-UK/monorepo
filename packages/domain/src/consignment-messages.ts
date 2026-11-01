import type { LegalEntityStatus } from "@auction/types";
import { organisationStateAllows } from "./organisation-state-policy.js";
import {
  type SubmissionMutationActor,
  type SubmissionMutationDenial,
  submissionMutationPolicy,
} from "./submission-mutation-policy.js";
import { canSeeSubmission, submissionSenderScope } from "./submission-visibility.js";

/**
 * Messages on a consignment: one thread per consignment between the account's people and the
 * specialist. The client side writes as the account; the staff side as LAX.
 */
export const CONSIGNMENT_MESSAGE_SIDES = ["client", "staff"] as const;
export type ConsignmentMessageSide = (typeof CONSIGNMENT_MESSAGE_SIDES)[number];

/** The longest message, in characters: a long letter, never a document. */
export const CONSIGNMENT_MESSAGE_MAX_LENGTH = 4000;
/** Files on one message. More belong in the consignment's documents. */
export const CONSIGNMENT_MESSAGE_MAX_ATTACHMENTS = 5;
/** Photos and PDFs only, as the consignment's other documents. */
export const CONSIGNMENT_MESSAGE_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const CONSIGNMENT_MESSAGE_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;

/** The side that did not write a message: the one whose reading it is. */
export function otherSide(side: ConsignmentMessageSide): ConsignmentMessageSide {
  return side === "client" ? "staff" : "client";
}

/** A thread waits for LAX while the newest message in it came from the client. */
export function threadAwaitsStaff(lastSide: ConsignmentMessageSide | null): boolean {
  return lastSide === "client";
}

/**
 * The text as stored: line endings made plain, trailing spaces and runs of blank lines removed,
 * and trimmed. What the person wrote otherwise stays as written.
 */
export function normaliseConsignmentMessageBody(body: string): string {
  return body
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type ConsignmentMessageProblemCode =
  | "message_empty"
  | "message_too_long"
  | "message_too_many_attachments"
  | "message_duplicate_attachment";

export type ConsignmentMessageProblem = { code: ConsignmentMessageProblemCode; message: string };

const PROBLEMS: Record<ConsignmentMessageProblemCode, string> = {
  message_empty: "Write a message or attach a file.",
  message_too_long: `Keep the message under ${CONSIGNMENT_MESSAGE_MAX_LENGTH.toLocaleString("en-GB")} characters.`,
  message_too_many_attachments: `Attach up to ${CONSIGNMENT_MESSAGE_MAX_ATTACHMENTS} files to one message.`,
  message_duplicate_attachment: "The same file is attached twice.",
};

/** Why a message cannot be sent as written, or `null` when it can. Reads the normalised body. */
export function consignmentMessageProblem(draft: {
  body: string;
  attachmentIds: readonly string[];
}): ConsignmentMessageProblem | null {
  const problem = (code: ConsignmentMessageProblemCode) => ({ code, message: PROBLEMS[code] });
  const body = normaliseConsignmentMessageBody(draft.body);
  if (body.length === 0 && draft.attachmentIds.length === 0) return problem("message_empty");
  if (body.length > CONSIGNMENT_MESSAGE_MAX_LENGTH) return problem("message_too_long");
  if (draft.attachmentIds.length > CONSIGNMENT_MESSAGE_MAX_ATTACHMENTS) {
    return problem("message_too_many_attachments");
  }
  if (new Set(draft.attachmentIds).size !== draft.attachmentIds.length) {
    return problem("message_duplicate_attachment");
  }
  return null;
}

/** Writing is paused while the organisation cannot trade; the thread stays readable. */
export const ORGANISATION_MESSAGES_PAUSED = {
  code: "organisation_messages_paused",
  message:
    "Writing to specialists is paused for this organisation. Contact us if you need to reach the team.",
} as const;

export type ConsignmentThreadWriteDenial = SubmissionMutationDenial | "organisation";

/** What a member may do in a consignment's thread. */
export type ConsignmentThreadAccess = {
  /** Whether the member may read the thread at all (they may see the consignment). */
  read: boolean;
  write:
    | { allowed: true }
    | { allowed: false; reason: ConsignmentThreadWriteDenial; message: string };
  /**
   * Whether opening the thread marks the specialist's messages read for the account. Only the
   * people who would answer do, so a viewer reading along never clears an owner's task.
   */
  marksRead: boolean;
};

/**
 * A member's access to a consignment's thread:
 * - who reads it follows who sees the consignment (`submissionSenderScope`);
 * - who writes follows who changes it (`submissionMutationPolicy`, "message"): owners and admins
 *   on any, the consignor on the ones they sent; support staff viewing the account write nothing;
 * - an organisation whose state closes trading keeps the thread to read
 *   (`organisationStatePolicy`, "message_specialist").
 *
 * `actor` is `null` for the holder of a person's own account; `organisationStatus` is `null`
 * when the account is a person's own.
 */
export function consignmentThreadAccess(input: {
  actor: SubmissionMutationActor;
  submission: { submittedByUserId?: string | null | undefined };
  organisationStatus: LegalEntityStatus | null;
}): ConsignmentThreadAccess {
  const { actor, submission, organisationStatus } = input;
  const read =
    actor === null ||
    canSeeSubmission({
      scope: submissionSenderScope(actor.member),
      submittedByUserId: submission.submittedByUserId,
      viewerUserId: actor.userId,
    });
  if (!read) {
    return {
      read,
      write: { allowed: false, reason: "not_sender", message: "Not found" },
      marksRead: false,
    };
  }
  const policy = submissionMutationPolicy(actor, submission, "message");
  if (!policy.allowed) {
    return {
      read,
      write: { allowed: false, reason: policy.reason, message: policy.message },
      marksRead: false,
    };
  }
  if (organisationStatus && !organisationStateAllows(organisationStatus, "message_specialist")) {
    return {
      read,
      write: {
        allowed: false,
        reason: "organisation",
        message: ORGANISATION_MESSAGES_PAUSED.message,
      },
      marksRead: true,
    };
  }
  return { read, write: { allowed: true }, marksRead: true };
}
