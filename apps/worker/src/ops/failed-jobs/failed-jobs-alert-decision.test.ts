import { describe, expect, it } from "vitest";
import {
  EMPTY_ALERT_STATE,
  FAILED_JOBS_ALERT_DEFAULTS,
  type FailedJobGroup,
  type FailedJobsAlertState,
  decideFailedJobsAlert,
} from "./failed-jobs-alert-decision.js";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = new Date("2026-11-13T08:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

function group(patch: Partial<FailedJobGroup> & { key: string }): FailedJobGroup {
  return {
    jobType: "delivery:zoho",
    jobLabel: "user.registered to zoho",
    errorCode: "ZOHO_INVALID_DATA",
    count: 5,
    newInWindow: 0,
    firstSeen: ago(10 * DAY),
    lastSeen: ago(2 * DAY),
    ...patch,
  };
}

const decide = (
  groups: FailedJobGroup[],
  state: FailedJobsAlertState = EMPTY_ALERT_STATE,
  now = NOW,
) => decideFailedJobsAlert({ groups, state, now, config: FAILED_JOBS_ALERT_DEFAULTS });

describe("decideFailedJobsAlert", () => {
  it("keeps the defaults: 10 per group, 25 in all, over 24 hours, repeating after 7 days", () => {
    expect(FAILED_JOBS_ALERT_DEFAULTS).toEqual({
      groupGrowth: 10,
      totalGrowth: 25,
      windowMs: DAY,
      repeatAfterMs: 7 * DAY,
    });
  });

  it("raises nothing when nothing is new or growing, and keeps no state", () => {
    const result = decide([group({ key: "a", newInWindow: 9 })]);
    expect(result).toEqual({ alert: null, state: { groups: {}, total: null } });
    expect(decide([]).alert).toBeNull();
  });

  it("raises a group first seen in the last 24 hours, however small", () => {
    const fresh = group({ key: "a", count: 1, newInWindow: 1, firstSeen: ago(3 * HOUR) });
    const result = decide([fresh, group({ key: "old" })]);
    expect(result.alert?.groups).toEqual([{ ...fresh, reasons: ["new"] }]);
    expect(result.alert?.totalGrew).toBe(false);
    expect(result.state.groups).toEqual({ a: { count: 1, alertedAt: NOW.toISOString() } });
  });

  it("raises a group that gained 10 or more in 24 hours, not 9", () => {
    expect(decide([group({ key: "a", count: 40, newInWindow: 9 })]).alert).toBeNull();
    const result = decide([group({ key: "a", count: 40, newInWindow: 10 })]);
    expect(result.alert?.groups.map((g) => [g.key, g.reasons])).toEqual([["a", ["grew"]]]);
  });

  it("does not raise the total at 24 new failures when no group crosses its own line", () => {
    const groups = [9, 8, 7].map((newInWindow, index) =>
      group({ key: String(index), count: 20, newInWindow }),
    );
    expect(decide(groups).alert).toBeNull();
  });

  it("raises the total at exactly 25 and names the groups that grew most, without marking them", () => {
    const groups = [
      group({ key: "a", count: 9, newInWindow: 9 }),
      group({ key: "b", count: 9, newInWindow: 8 }),
      group({ key: "c", count: 8, newInWindow: 8 }),
      group({ key: "d", count: 30, newInWindow: 0 }),
    ];
    const result = decide(groups);
    expect(result.alert?.totalGrew).toBe(true);
    expect(result.alert?.groups.map((g) => g.key)).toEqual(["a", "b", "c"]);
    expect(result.alert?.groups.every((g) => g.reasons.length === 0)).toBe(true);
    expect(result.state).toEqual({
      groups: {},
      total: { count: 56, alertedAt: NOW.toISOString() },
    });
  });

  it("stays quiet for a group that alerted until it grows further", () => {
    const first = decide([group({ key: "a", count: 49, newInWindow: 12 })]);
    expect(first.alert).not.toBeNull();
    const nextDay = new Date(NOW.getTime() + DAY);
    const same = decide([group({ key: "a", count: 49, newInWindow: 12 })], first.state, nextDay);
    expect(same.alert).toBeNull();
    expect(same.state).toEqual(first.state);
    const grown = decide([group({ key: "a", count: 61, newInWindow: 12 })], first.state, nextDay);
    expect(grown.alert?.groups.map((g) => g.count)).toEqual([61]);
    expect(grown.state.groups.a).toEqual({ count: 61, alertedAt: nextDay.toISOString() });
  });

  it("does not raise a new group twice when the next run still finds it inside the window", () => {
    const fresh = group({ key: "a", count: 2, newInWindow: 2, firstSeen: ago(1000) });
    const first = decide([fresh]);
    const nextRun = new Date(NOW.getTime() + DAY - 2000);
    expect(decide([fresh], first.state, nextRun).alert).toBeNull();
  });

  it("raises a group again after 7 days even if it has not grown", () => {
    const state = {
      groups: { a: { count: 50, alertedAt: ago(7 * DAY).toISOString() } },
      total: null,
    };
    const growing = group({ key: "a", count: 50, newInWindow: 10 });
    expect(decide([growing], state).alert?.groups).toHaveLength(1);
    const sixDays = {
      groups: { a: { count: 50, alertedAt: ago(6 * DAY).toISOString() } },
      total: null,
    };
    expect(decide([growing], sixDays).alert).toBeNull();
  });

  it("holds the total back the same way", () => {
    const groups = [
      group({ key: "a", count: 30, newInWindow: 9 }),
      group({ key: "b", count: 30, newInWindow: 16 }),
    ];
    const first = decide(groups);
    expect(first.alert?.totalGrew).toBe(true);
    const nextDay = new Date(NOW.getTime() + DAY);
    expect(decide(groups, first.state, nextDay).alert).toBeNull();
    const more = [...groups, group({ key: "c", count: 1, newInWindow: 0 })];
    expect(decide(more, first.state, nextDay).alert?.totalGrew).toBe(true);
  });

  it("drops marks for groups that are gone or too old to hold anything back", () => {
    const state: FailedJobsAlertState = {
      groups: {
        gone: { count: 3, alertedAt: ago(DAY).toISOString() },
        stale: { count: 3, alertedAt: ago(8 * DAY).toISOString() },
        kept: { count: 3, alertedAt: ago(DAY).toISOString() },
      },
      total: { count: 30, alertedAt: ago(8 * DAY).toISOString() },
    };
    const result = decide([group({ key: "stale" }), group({ key: "kept" })], state);
    expect(result.alert).toBeNull();
    expect(result.state).toEqual({ groups: { kept: state.groups.kept }, total: null });
  });

  it("lists the groups with the most new failures first and names both reasons", () => {
    const result = decide([
      group({ key: "small", count: 2, newInWindow: 2, firstSeen: ago(HOUR) }),
      group({ key: "big", count: 49, newInWindow: 30, firstSeen: ago(20 * HOUR) }),
    ]);
    expect(result.alert?.groups.map((g) => [g.key, g.reasons])).toEqual([
      ["big", ["new", "grew"]],
      ["small", ["new"]],
    ]);
    expect(result.alert?.totalGrew).toBe(true);
  });
});
