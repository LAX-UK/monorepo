import { type EntityActor, threadAssignee } from "@auction/domain";
import type {
  ConsignmentThreadSubject,
  IConsignmentMessageRepository,
} from "@auction/persistence/interfaces";
import type { ConsignmentThreadAssigneeView } from "@auction/validators";

/** The upload kind a message's files are uploaded as (`upload.policy.ts`). */
export const CONSIGNMENT_MESSAGE_UPLOAD_KIND = "consignment_message_attachment";

/** A member of the account a client request acts for. */
export type ConsignmentThreadMember = {
  legalEntityId: string;
  userId: string;
  actor: EntityActor;
};

export type ConsignmentMessageDraft = {
  body: string;
  attachments: ReadonlyArray<{ uploadObjectId: string; fileName?: string | null | undefined }>;
};

export type ConsignmentMessageFailure = {
  ok: false;
  status: 400 | 403 | 404 | 409;
  code: string;
  error: string;
  /** More for the answer's body (the messages a reply was held for). */
  extra?: Record<string, unknown> | undefined;
};
export type ConsignmentMessageOutcome<T> = { ok: true; value: T } | ConsignmentMessageFailure;

export function failure(
  status: ConsignmentMessageFailure["status"],
  code: string,
  error: string,
  extra?: Record<string, unknown>,
): ConsignmentMessageFailure {
  return { ok: false, status, code, error, ...(extra ? { extra } : {}) };
}

export const NOT_FOUND: ConsignmentMessageFailure = failure(404, "not_found", "Not found");

const ATTACHMENT_NOT_READY = failure(
  400,
  "attachment_not_ready",
  "A file is still being checked. Try again in a moment.",
);

const ATTACHMENT_INVALID = failure(
  400,
  "attachment_invalid",
  "A file could not be attached. Upload it again.",
);

/** Each file was uploaded by the author for a message, and has passed its checks. */
export async function checkUploads(
  messages: Pick<IConsignmentMessageRepository, "findUploads">,
  authorUserId: string,
  ids: readonly string[],
): Promise<ConsignmentMessageFailure | null> {
  if (ids.length === 0) return null;
  const uploads = await messages.findUploads(ids);
  const byId = new Map(uploads.map((upload) => [upload.id, upload]));
  for (const id of ids) {
    const upload = byId.get(id);
    if (
      !upload ||
      upload.ownerUserId !== authorUserId ||
      upload.kind !== CONSIGNMENT_MESSAGE_UPLOAD_KIND
    ) {
      return ATTACHMENT_INVALID;
    }
    if (upload.status !== "active") {
      return upload.status === "rejected" ? ATTACHMENT_INVALID : ATTACHMENT_NOT_READY;
    }
  }
  return null;
}

/** Who has the thread now; a cover shows when it ends, if it has an end date. */
export function assigneeView(
  subject: Pick<ConsignmentThreadSubject, "specialist" | "covering" | "coveringUntil">,
): ConsignmentThreadAssigneeView | null {
  const assignee = threadAssignee({ specialist: subject.specialist, covering: subject.covering });
  if (!assignee) return null;
  return assignee.covering && subject.coveringUntil
    ? { ...assignee, coveringUntil: subject.coveringUntil.toISOString() }
    : assignee;
}
