import type pino from "pino";
import type { WorkerEnv } from "../env.js";
import { postInternalCronJob } from "../jobs/post-internal-cron-job.js";

export type WorkerAbsenteeReplayPort = {
  replayScheduledForLot: (lotId: string) => Promise<void>;
};

/** Named API rollback adapter (explicit; not secret-driven silent null). */
export function createApiRollbackAbsenteeReplayPort(input: {
  apiBaseUrl: string;
  cronSecret: string;
  log: pino.Logger;
}): WorkerAbsenteeReplayPort | null {
  if (!input.cronSecret.trim() || !input.apiBaseUrl.trim()) {
    return null;
  }
  return {
    replayScheduledForLot: async (lotId) => {
      await postInternalCronJob({
        apiBaseUrl: input.apiBaseUrl,
        cronSecret: input.cronSecret,
        path: "replay-absentee-for-lot",
        body: { lotId },
        log: input.log,
      });
    },
  };
}

export function createWorkerAbsenteeReplayPort(input: {
  env: WorkerEnv;
  apiBaseUrl: string;
  cronSecret: string;
  log: pino.Logger;
  localReplay: WorkerAbsenteeReplayPort | null;
}): WorkerAbsenteeReplayPort | null {
  if (input.env.ABSENTEE_REPLAY_OWNER === "worker") {
    return input.localReplay;
  }
  return createApiRollbackAbsenteeReplayPort({
    apiBaseUrl: input.apiBaseUrl,
    cronSecret: input.cronSecret,
    log: input.log,
  });
}

export function isWorkerAbsenteeReplayReady(input: {
  env: WorkerEnv;
  cronSecret: string;
  apiBaseUrl: string;
  localReplayReady: boolean;
}): boolean {
  if (input.env.ABSENTEE_REPLAY_OWNER === "api_rollback") {
    return input.cronSecret.trim().length > 0 && input.apiBaseUrl.trim().length > 0;
  }
  return input.localReplayReady;
}
