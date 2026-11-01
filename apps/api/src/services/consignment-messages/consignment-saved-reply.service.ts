import { SAVED_REPLY_LIMIT } from "@auction/domain";
import type {
  IConsignmentSavedReplyRepository,
  SavedReplyRecord,
} from "@auction/persistence/interfaces";
import type { SavedReplyBody, SavedReplyView } from "@auction/validators";
import {
  type ConsignmentMessageFailure,
  type ConsignmentMessageOutcome,
  NOT_FOUND,
  failure,
} from "./consignment-message.shared.js";
import type { ConsignmentThreadAudit } from "./consignment-thread-audit.js";

function toView(record: SavedReplyRecord): SavedReplyView {
  return {
    id: record.id,
    title: record.title,
    body: record.body,
    updatedAt: record.updatedAt.toISOString(),
    updatedBy: record.updatedBy,
  };
}

const TITLE_TAKEN = failure(
  409,
  "saved_reply_title_taken",
  "A saved reply already has that title.",
);
const LIMIT_REACHED = failure(
  400,
  "saved_reply_limit",
  `You can keep up to ${SAVED_REPLY_LIMIT} saved replies. Remove one to add another.`,
);

export type ConsignmentSavedReplyDeps = {
  replies: IConsignmentSavedReplyRepository;
  audit: ConsignmentThreadAudit;
  now?: () => Date;
};

/** The team's saved replies: anyone who reads the inbox lists them; managers change them. */
export class ConsignmentSavedReplyService {
  private readonly now: () => Date;

  constructor(private readonly deps: ConsignmentSavedReplyDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async list(): Promise<SavedReplyView[]> {
    return (await this.deps.replies.list()).map(toView);
  }

  async create(
    staffUserId: string,
    body: SavedReplyBody,
  ): Promise<ConsignmentMessageOutcome<SavedReplyView>> {
    const result = await this.deps.replies.create({
      title: body.title,
      body: body.body,
      byUserId: staffUserId,
      at: this.now(),
      limit: SAVED_REPLY_LIMIT,
    });
    const refused = refusal(result.outcome);
    if (refused) return refused;
    if (result.outcome !== "saved") return NOT_FOUND;
    await this.deps.audit.savedReplyChanged({
      kind: "created",
      savedReplyId: result.reply.id,
      title: result.reply.title,
      actorUserId: staffUserId,
    });
    return { ok: true, value: toView(result.reply) };
  }

  async update(
    staffUserId: string,
    id: string,
    body: SavedReplyBody,
  ): Promise<ConsignmentMessageOutcome<SavedReplyView>> {
    const result = await this.deps.replies.update({
      id,
      title: body.title,
      body: body.body,
      byUserId: staffUserId,
      at: this.now(),
    });
    const refused = refusal(result.outcome);
    if (refused) return refused;
    if (result.outcome !== "saved") return NOT_FOUND;
    await this.deps.audit.savedReplyChanged({
      kind: "updated",
      savedReplyId: id,
      title: result.reply.title,
      actorUserId: staffUserId,
    });
    return { ok: true, value: toView(result.reply) };
  }

  async remove(
    staffUserId: string,
    id: string,
  ): Promise<ConsignmentMessageOutcome<{ removed: true }>> {
    const removed = await this.deps.replies.remove(id);
    if (!removed) return NOT_FOUND;
    await this.deps.audit.savedReplyChanged({
      kind: "deleted",
      savedReplyId: id,
      actorUserId: staffUserId,
    });
    return { ok: true, value: { removed: true } };
  }
}

function refusal(outcome: string): ConsignmentMessageFailure | null {
  if (outcome === "duplicate_title") return TITLE_TAKEN;
  if (outcome === "limit_reached") return LIMIT_REACHED;
  return null;
}
