import type pino from "pino";
import type { ProjectorFailureOutcome } from "../projectors/lib/projector-failure-guard.js";

export interface IProjectorFailureRecorder {
  record(args: {
    projectorName: string;
    eventId: number;
    err: unknown;
    log: pino.Logger;
  }): Promise<ProjectorFailureOutcome>;
}
