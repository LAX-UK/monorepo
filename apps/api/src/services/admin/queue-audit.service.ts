import type { Logger } from "pino";
import type { ActorContext } from "../interfaces/queue-inspector.js";

export type QueueAuditAction = "retry" | "pause" | "resume" | "replay_dlq";

export interface IQueueAuditService {
  log(
    action: QueueAuditAction,
    input: {
      actor: ActorContext;
      queue?: string;
      jobId?: string;
      success: boolean;
      errorMessage?: string;
    },
  ): void;
}

export class StructuredQueueAuditService implements IQueueAuditService {
  constructor(private readonly logger: Logger) {}

  log(
    action: QueueAuditAction,
    input: {
      actor: ActorContext;
      queue?: string;
      jobId?: string;
      success: boolean;
      errorMessage?: string;
    },
  ): void {
    this.logger.info(
      {
        action,
        actorId: input.actor.userId,
        actorStaffRole: input.actor.staffRole,
        queue: input.queue,
        jobId: input.jobId,
        requestId: input.actor.requestId,
        success: input.success,
        errorMessage: input.errorMessage,
      },
      "queue_admin_mutation",
    );
  }
}
