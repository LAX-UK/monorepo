import {
  type AlertMark,
  EMPTY_ALERT_STATE,
  type FailedJobsAlertState,
} from "./failed-jobs-alert-decision.js";
import type { FailedJobsAlertStateStore } from "./failed-jobs-watch.service.js";

export const FAILED_JOBS_ALERT_STATE_KEY = "ops:failed-jobs-watch:alerted";

/** Kept a while past the longest a mark can hold an alert back (7 days by default). */
const STATE_TTL_SECONDS = 30 * 24 * 3600;

type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", seconds: number): Promise<unknown>;
};

function isMark(value: unknown): value is AlertMark {
  const mark = value as AlertMark | null;
  return (
    typeof mark === "object" &&
    mark !== null &&
    typeof mark.count === "number" &&
    typeof mark.alertedAt === "string" &&
    !Number.isNaN(Date.parse(mark.alertedAt))
  );
}

/** Reads stored state, keeping only well-formed marks; anything unreadable starts afresh. */
export function parseAlertState(raw: string | null): FailedJobsAlertState {
  if (!raw) return EMPTY_ALERT_STATE;
  try {
    const parsed = JSON.parse(raw) as { groups?: unknown; total?: unknown };
    const groups = Object.fromEntries(
      Object.entries((parsed.groups as Record<string, unknown>) ?? {}).filter(([, mark]) =>
        isMark(mark),
      ),
    ) as Record<string, AlertMark>;
    return { groups, total: isMark(parsed.total) ? parsed.total : null };
  } catch {
    return EMPTY_ALERT_STATE;
  }
}

/**
 * What the Failed jobs watch alerted last, in one Redis key. Losing it costs at most one repeat
 * alert, so it lives beside the queues rather than in the database.
 */
export class RedisFailedJobsAlertState implements FailedJobsAlertStateStore {
  constructor(private readonly redis: RedisLike) {}

  async read(): Promise<FailedJobsAlertState> {
    return parseAlertState(await this.redis.get(FAILED_JOBS_ALERT_STATE_KEY));
  }

  async write(state: FailedJobsAlertState): Promise<void> {
    await this.redis.set(
      FAILED_JOBS_ALERT_STATE_KEY,
      JSON.stringify(state),
      "EX",
      STATE_TTL_SECONDS,
    );
  }
}
