import type { IConsignmentMessageRepository } from "@auction/persistence/interfaces";
import type { IConsignmentAssignment } from "./consignment-message.ports.js";
import type { ConsignmentThreadAudit } from "./consignment-thread-audit.js";

export type ConsignmentAssignmentDeps = {
  messages: Pick<IConsignmentMessageRepository, "assignThread" | "endElapsedCovers">;
  audit: ConsignmentThreadAudit;
  now?: () => Date;
};

/**
 * Who owns a consignment and its thread. The inbox, the thread page and the consignment's own
 * page all hand work over through here, so every change lands in the thread's history and on the
 * consignment's record, and a cover that reaches its end date goes back to the specialist.
 */
export class ConsignmentAssignmentService implements IConsignmentAssignment {
  private readonly now: () => Date;

  constructor(private readonly deps: ConsignmentAssignmentDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async assign(
    actorUserId: string,
    submissionId: string,
    target: { assignedToUserId: string | null; covering: boolean; coveringUntil?: Date | null },
  ): Promise<"changed" | "unchanged" | "no_thread"> {
    const coveringUntil = target.covering ? (target.coveringUntil ?? null) : null;
    const result = await this.deps.messages.assignThread({
      submissionId,
      actorUserId,
      assignedToUserId: target.assignedToUserId,
      covering: target.covering,
      coveringUntil,
      at: this.now(),
    });
    if (result.outcome !== "changed") return result.outcome;
    const kind =
      result.event ?? (target.assignedToUserId ? ("assigned" as const) : ("unassigned" as const));
    await this.deps.audit.threadChanged({
      kind,
      submissionId,
      actorUserId,
      subjectUserId: target.assignedToUserId,
      ...(kind === "covering" && coveringUntil ? { coveringUntil } : {}),
    });
    return "changed";
  }

  /** Sends every thread whose cover has run out back to its specialist; returns how many. */
  async endElapsedCovers(): Promise<number> {
    const ended = await this.deps.messages.endElapsedCovers(this.now());
    for (const cover of ended) {
      await this.deps.audit.threadChanged({
        kind: cover.specialist ? "assigned" : "unassigned",
        submissionId: cover.submissionId,
        actorUserId: null,
        subjectUserId: cover.specialist?.userId ?? null,
      });
    }
    return ended.length;
  }
}
