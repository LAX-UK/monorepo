import type { createDb } from "@auction/db";
import {
  DrizzleFailedJobReviewRepository,
  DrizzleIntegrationDeadLetterRepository,
} from "@auction/persistence/repositories";
import type { Redis } from "ioredis";
import type { Logger } from "pino";
import type { WorkerEnv } from "../env.js";
import { createAlertSink } from "../lib/alert-sink.js";
import type { FailedJobsAlertConfig } from "../ops/failed-jobs/failed-jobs-alert-decision.js";
import {
  type FailedJobsAlertMessage,
  FailedJobsWatch,
} from "../ops/failed-jobs/failed-jobs-watch.service.js";
import { RedisFailedJobsAlertState } from "../ops/failed-jobs/redis-failed-jobs-alert-state.js";

const HOUR_MS = 3_600_000;

type FailedJobsAlertEnv = Pick<
  WorkerEnv,
  | "FAILED_JOBS_ALERT_GROUP_GROWTH"
  | "FAILED_JOBS_ALERT_TOTAL_GROWTH"
  | "FAILED_JOBS_ALERT_WINDOW_HOURS"
  | "FAILED_JOBS_ALERT_REPEAT_DAYS"
>;

/** The thresholds from the worker's env, whose defaults are `FAILED_JOBS_ALERT_DEFAULTS`. */
export function failedJobsAlertConfig(env: FailedJobsAlertEnv): FailedJobsAlertConfig {
  return {
    groupGrowth: env.FAILED_JOBS_ALERT_GROUP_GROWTH,
    totalGrowth: env.FAILED_JOBS_ALERT_TOTAL_GROWTH,
    windowMs: env.FAILED_JOBS_ALERT_WINDOW_HOURS * HOUR_MS,
    repeatAfterMs: env.FAILED_JOBS_ALERT_REPEAT_DAYS * 24 * HOUR_MS,
  };
}

/** The Failed jobs watch over the same stores the Failed jobs page reads. */
export function createFailedJobsWatch(deps: {
  env: FailedJobsAlertEnv;
  db: ReturnType<typeof createDb>;
  redis: Redis;
  log: Logger;
}): FailedJobsWatch {
  return new FailedJobsWatch({
    sources: [
      new DrizzleFailedJobReviewRepository(deps.db),
      new DrizzleIntegrationDeadLetterRepository(deps.db),
    ],
    state: new RedisFailedJobsAlertState(deps.redis),
    alerts: createAlertSink<FailedJobsAlertMessage>(deps.log),
    config: failedJobsAlertConfig(deps.env),
    now: () => new Date(),
  });
}
