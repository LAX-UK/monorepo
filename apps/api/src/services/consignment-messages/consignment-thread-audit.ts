import type { IDomainEventSink } from "../domain-event-sink.js";

export type ThreadChange = "closed" | "reopened" | "assigned" | "unassigned" | "covering";

/**
 * Records what staff do with threads and saved replies on the consignment's history. The event
 * types are deliberately not `submission.*`, so the account's activity lists never show them.
 */
export class ConsignmentThreadAudit {
  constructor(private readonly events: IDomainEventSink | null) {}

  async threadChanged(input: {
    kind: ThreadChange;
    submissionId: string;
    /** Null when the client's message reopened the thread. */
    actorUserId: string | null;
    subjectUserId?: string | null | undefined;
    covering?: boolean | undefined;
    /** When a cover ends, for the history of who covered until when. */
    coveringUntil?: Date | undefined;
  }): Promise<void> {
    const eventType =
      input.kind === "closed"
        ? "consignment_thread.closed"
        : input.kind === "reopened"
          ? "consignment_thread.reopened"
          : "consignment_thread.assigned";
    await this.events?.publish({
      aggregateType: "submission",
      aggregateId: input.submissionId,
      eventType,
      payload: {
        submissionId: input.submissionId,
        kind: input.kind,
        ...(input.kind === "assigned" || input.kind === "unassigned" || input.kind === "covering"
          ? {
              assignedToUserId: input.subjectUserId ?? null,
              covering: input.kind === "covering",
              ...(input.coveringUntil ? { coveringUntil: input.coveringUntil.toISOString() } : {}),
            }
          : {}),
      },
      actorUserId: input.actorUserId,
      schemaVersion: 1,
    });
  }

  async savedReplyChanged(input: {
    kind: "created" | "updated" | "deleted";
    savedReplyId: string;
    title?: string | undefined;
    actorUserId: string;
  }): Promise<void> {
    await this.events?.publish({
      aggregateType: "consignment_saved_reply",
      aggregateId: input.savedReplyId,
      eventType: `consignment_saved_reply.${input.kind}`,
      payload: {
        savedReplyId: input.savedReplyId,
        ...(input.title ? { title: input.title } : {}),
      },
      actorUserId: input.actorUserId,
      schemaVersion: 1,
    });
  }
}
