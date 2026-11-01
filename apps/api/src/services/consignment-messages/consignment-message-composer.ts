import {
  CONSIGNMENT_MESSAGE_MAX_ATTACHMENTS,
  type ConsignmentMessageSide,
  type ConsignmentMessageVisibility,
  consignmentMessageProblem,
  normaliseConsignmentMessageBody,
} from "@auction/domain";
import type {
  ConsignmentMessageRow,
  ConsignmentThreadSubject,
  IConsignmentMessageRepository,
} from "@auction/persistence/interfaces";
import {
  type ConsignmentMessageDraft,
  type ConsignmentMessageFailure,
  checkUploads,
  failure,
} from "./consignment-message.shared.js";

export type ComposedMessage = {
  row: ConsignmentMessageRow;
  reopened: boolean;
  body: string;
};

/**
 * Checks and stores one message, whoever writes it, and reads it back as stored. Which side may
 * write, whether the reply is held and who is told are the callers' rules.
 */
export class ConsignmentMessageComposer {
  constructor(private readonly messages: IConsignmentMessageRepository) {}

  async compose(input: {
    subject: ConsignmentThreadSubject;
    side: ConsignmentMessageSide;
    visibility: ConsignmentMessageVisibility;
    authorUserId: string;
    draft: ConsignmentMessageDraft;
    at: Date;
    deliverAfter: Date | null;
  }): Promise<{ ok: true; value: ComposedMessage } | ConsignmentMessageFailure> {
    const { draft, subject } = input;
    const attachmentIds = draft.attachments.map((a) => a.uploadObjectId);
    const problem = consignmentMessageProblem({ body: draft.body, attachmentIds });
    if (problem?.code === "message_too_many_attachments") {
      return failure(400, "attachment_too_many", problem.message, {
        limit: { maxCount: CONSIGNMENT_MESSAGE_MAX_ATTACHMENTS },
      });
    }
    if (problem) return failure(400, problem.code, problem.message);
    const refused = await checkUploads(this.messages, input.authorUserId, attachmentIds);
    if (refused) return refused;
    const body = normaliseConsignmentMessageBody(draft.body);
    const { messageId, reopened } = await this.messages.append({
      submissionId: subject.submissionId,
      authorUserId: input.authorUserId,
      side: input.side,
      visibility: input.visibility,
      body,
      at: input.at,
      deliverAfter: input.deliverAfter,
      attachments: draft.attachments.map((a) => ({
        uploadObjectId: a.uploadObjectId,
        fileName: a.fileName?.trim() || null,
      })),
    });
    const rows = await this.messages.listMessages(subject.submissionId, { kind: "staff" });
    const row = rows.find((r) => r.id === messageId);
    if (!row) throw new Error("consignment message was not read back");
    return { ok: true, value: { row, reopened, body } };
  }
}
