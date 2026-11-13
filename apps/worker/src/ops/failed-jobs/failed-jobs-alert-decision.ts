/**
 * When Failed jobs (Needs review) has grown enough for a person to look, decided from counts
 * alone. Pure: the watch reads the groups and the state, this says whether to alert, what the
 * alert names, and the state to keep. Nothing here sees a payload or an error text.
 */

/** The thresholds; `FAILED_JOBS_ALERT_DEFAULTS` holds the defaults the worker's env can override. */
export type FailedJobsAlertConfig = {
  /** A group that gains this many failures in the window alerts. */
  readonly groupGrowth: number;
  /** All of Needs review gaining this many failures in the window alerts. */
  readonly totalGrowth: number;
  /** The window "new" and "grew" are measured over. */
  readonly windowMs: number;
  /** A group that alerted is quiet until it grows further, or until this long has passed. */
  readonly repeatAfterMs: number;
};

const HOUR_MS = 3_600_000;

export const FAILED_JOBS_ALERT_DEFAULTS: FailedJobsAlertConfig = {
  groupGrowth: 10,
  totalGrowth: 25,
  windowMs: 24 * HOUR_MS,
  repeatAfterMs: 7 * 24 * HOUR_MS,
};

/** One kind of failure waiting for review: one job type, one error code. */
export type FailedJobGroup = {
  /** Stable across runs: the job type, job name and error code. */
  readonly key: string;
  /** The Failed jobs "Job type" filter value (`send-email`, `delivery:zoho`). */
  readonly jobType: string;
  readonly jobLabel: string;
  readonly errorCode: string;
  readonly count: number;
  /** Failures in the group that first failed inside the window. */
  readonly newInWindow: number;
  readonly firstSeen: Date;
  readonly lastSeen: Date;
};

/** What was last alerted for a group (or for the total), kept between runs. */
export type AlertMark = { readonly count: number; readonly alertedAt: string };

export type FailedJobsAlertState = {
  readonly groups: Readonly<Record<string, AlertMark>>;
  readonly total: AlertMark | null;
};

export const EMPTY_ALERT_STATE: FailedJobsAlertState = { groups: {}, total: null };

export type GroupReason = "new" | "grew";

export type AlertedGroup = FailedJobGroup & { readonly reasons: readonly GroupReason[] };

export type FailedJobsAlert = {
  /** Groups that are new or grew, most new failures first. */
  readonly groups: readonly AlertedGroup[];
  /** Needs review as a whole grew past its threshold. */
  readonly totalGrew: boolean;
  readonly total: number;
  readonly totalNewInWindow: number;
};

export type FailedJobsAlertDecision = {
  /** Null when nothing should be raised. */
  readonly alert: FailedJobsAlert | null;
  readonly state: FailedJobsAlertState;
};

/** The groups shown beside a total that grew while no single group crossed its threshold. */
const CONTEXT_GROUPS = 5;

/** Whether a mark still holds back an alert: it is recent, and the count has not grown past it. */
function quiet(
  mark: AlertMark | undefined | null,
  count: number,
  now: Date,
  config: FailedJobsAlertConfig,
) {
  if (!mark) return false;
  const since = now.getTime() - Date.parse(mark.alertedAt);
  return since < config.repeatAfterMs && count <= mark.count;
}

function reasonsFor(
  group: FailedJobGroup,
  now: Date,
  config: FailedJobsAlertConfig,
): GroupReason[] {
  const reasons: GroupReason[] = [];
  if (now.getTime() - group.firstSeen.getTime() <= config.windowMs) reasons.push("new");
  if (group.newInWindow >= config.groupGrowth) reasons.push("grew");
  return reasons;
}

const byNewest = (a: FailedJobGroup, b: FailedJobGroup) =>
  b.newInWindow - a.newInWindow || b.count - a.count || a.key.localeCompare(b.key);

/**
 * Raises one alert when a group is new (first seen inside the window), when a group gained at
 * least `groupGrowth` failures in the window, or when Needs review as a whole gained at least
 * `totalGrowth`. A group, and the total, that already alerted stays quiet until its count is
 * higher than when it alerted, or `repeatAfterMs` has passed. Marks of groups that are gone, or
 * too old to hold anything back, are dropped.
 */
export function decideFailedJobsAlert(input: {
  groups: readonly FailedJobGroup[];
  state: FailedJobsAlertState;
  now: Date;
  config: FailedJobsAlertConfig;
}): FailedJobsAlertDecision {
  const { groups, state, now, config } = input;
  const nowIso = now.toISOString();
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  const totalNewInWindow = groups.reduce((sum, group) => sum + group.newInWindow, 0);

  const alerted: AlertedGroup[] = [];
  for (const group of groups) {
    const reasons = reasonsFor(group, now, config);
    if (reasons.length === 0 || quiet(state.groups[group.key], group.count, now, config)) continue;
    alerted.push({ ...group, reasons });
  }
  const totalGrew =
    totalNewInWindow >= config.totalGrowth && !quiet(state.total, total, now, config);

  const kept: Record<string, AlertMark> = {};
  const present = new Set(groups.map((group) => group.key));
  for (const [key, mark] of Object.entries(state.groups)) {
    if (present.has(key) && quiet(mark, 0, now, config)) kept[key] = mark;
  }
  const keptTotal = state.total && quiet(state.total, 0, now, config) ? state.total : null;

  if (alerted.length === 0 && !totalGrew) {
    return { alert: null, state: { groups: kept, total: keptTotal } };
  }

  for (const group of alerted) kept[group.key] = { count: group.count, alertedAt: nowIso };
  const shown =
    alerted.length > 0
      ? alerted.sort(byNewest)
      : [...groups]
          .filter((group) => group.newInWindow > 0)
          .sort(byNewest)
          .slice(0, CONTEXT_GROUPS)
          .map((group) => ({ ...group, reasons: [] }));
  return {
    alert: { groups: shown, totalGrew, total, totalNewInWindow },
    state: {
      groups: kept,
      total: totalGrew ? { count: total, alertedAt: nowIso } : keptTotal,
    },
  };
}
