import type { Database } from "@auction/db";
import { projectorState } from "@auction/db";
import { captureBackgroundError } from "@auction/observability";
import { eq } from "drizzle-orm";
import type pino from "pino";
import type { IProjectorFailureRecorder } from "../interfaces/projector-failure-recorder.js";
import type { IProjectorStateRepository } from "../interfaces/projector-state.repository.js";
import {
  type ProjectorFailureOutcome,
  parseStuckMeta,
  POISON_EVENT_THRESHOLD,
} from "../projectors/lib/projector-failure-guard.js";

export class DrizzleProjectorFailureRecorder implements IProjectorFailureRecorder {
  constructor(
    private readonly db: Database,
    private readonly stateRepo: IProjectorStateRepository,
  ) {}

  async record(args: {
    projectorName: string;
    eventId: number;
    err: unknown;
    log: pino.Logger;
  }): Promise<ProjectorFailureOutcome> {
    const message = args.err instanceof Error ? args.err.message : String(args.err);

    const [row] = await this.db
      .select({ lastError: projectorState.lastError })
      .from(projectorState)
      .where(eq(projectorState.projectorName, args.projectorName))
      .limit(1);

    const prior = parseStuckMeta(row?.lastError ?? null);
    const failures = prior && prior.eventId === args.eventId ? prior.failures + 1 : 1;

    if (failures >= POISON_EVENT_THRESHOLD) {
      const skipMessage = `Skipped poison event ${args.eventId} after ${failures} failures: ${message}`;
      const skipError = args.err instanceof Error ? args.err : new Error(skipMessage);
      args.log.error(
        { projector: args.projectorName, eventId: args.eventId, failures, err: args.err },
        "projector_poison_event_skipped",
      );
      captureBackgroundError("projector", skipError, {
        tags: {
          projector: args.projectorName,
          outcome: "poison_event_skipped",
        },
        extra: {
          eventId: args.eventId,
          failures,
          skipMessage,
        },
      });
      await this.stateRepo.recordError(args.projectorName, skipMessage);
      return { action: "skip", failures, message: skipMessage };
    }

    const meta = { eventId: args.eventId, failures, lastMessage: message };
    await this.stateRepo.recordError(args.projectorName, JSON.stringify(meta));

    args.log.error(
      { projector: args.projectorName, eventId: args.eventId, failures, err: args.err },
      "projector_event_failed_will_retry",
    );
    return { action: "retry", failures };
  }
}
