import type { FailedJobNeedsReviewGroup } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { errorCodeOf, jobLabelOf, toFailedJobGroups } from "./failed-job-group-key.js";
import {
  EMPTY_ALERT_STATE,
  FAILED_JOBS_ALERT_DEFAULTS,
  type FailedJobsAlertState,
} from "./failed-jobs-alert-decision.js";
import { FAILED_JOBS_ALERTS, FailedJobsWatch } from "./failed-jobs-watch.service.js";
import {
  FAILED_JOBS_ALERT_STATE_KEY,
  RedisFailedJobsAlertState,
  parseAlertState,
} from "./redis-failed-jobs-alert-state.js";

const NOW = new Date("2026-11-13T08:00:00.000Z");
const HOUR = 3_600_000;

function row(patch: Partial<FailedJobNeedsReviewGroup>): FailedJobNeedsReviewGroup {
  return {
    jobType: "delivery:zoho",
    jobName: "user.registered",
    errorLine: "ZOHO_INVALID_DATA: Email lena@north.com is not valid",
    count: 1,
    newSince: 0,
    firstFailedAt: new Date("2026-10-28T09:00:00.000Z"),
    lastFailedAt: new Date("2026-11-12T09:00:00.000Z"),
    ...patch,
  };
}

describe("Failed jobs groups", () => {
  it("names an error by its own code, or a fingerprint of its summary, never by its text", () => {
    expect(errorCodeOf("ZOHO_INVALID_DATA: Email lena@north.com is not valid")).toBe(
      "ZOHO_INVALID_DATA",
    );
    const code = errorCodeOf("Postmark said 422 for lena@north.com");
    expect(code).toMatch(/^err-[0-9a-f]{8}$/);
    // Stable for the same summary; a summary that reads differently is another group, as on the page.
    expect(errorCodeOf("Postmark said 422 for lena@north.com")).toBe(code);
    expect(errorCodeOf("Postmark said 500 for lena@north.com")).not.toBe(code);
    expect(errorCodeOf("HTTP 500")).toMatch(/^err-/);
    expect(errorCodeOf("")).toBe(errorCodeOf("   "));
  });

  it("labels background jobs as Failed jobs does and integrations by event and endpoint", () => {
    expect(jobLabelOf("delivery:zoho", "user.registered")).toBe("user.registered to zoho");
    expect(jobLabelOf("webhook:stripe", "charge.refunded")).toBe(
      "charge.refunded webhook from stripe",
    );
    expect(jobLabelOf("delivery:xero", null)).toBe("Delivery to xero");
    expect(jobLabelOf("some-queue", null)).toBe("Some queue");
  });

  it("folds rows that share a job type and error code into one group", () => {
    const groups = toFailedJobGroups([
      row({ count: 30, newSince: 2, errorLine: "ZOHO_INVALID_DATA: field a" }),
      row({
        count: 19,
        newSince: 1,
        errorLine: "ZOHO_INVALID_DATA: field b",
        firstFailedAt: new Date("2026-10-30T00:00:00.000Z"),
        lastFailedAt: new Date("2026-11-13T07:00:00.000Z"),
      }),
      row({ jobName: "payment.captured", count: 1 }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      jobType: "delivery:zoho",
      errorCode: "ZOHO_INVALID_DATA",
      count: 49,
      newInWindow: 3,
      firstSeen: new Date("2026-10-28T09:00:00.000Z"),
      lastSeen: new Date("2026-11-13T07:00:00.000Z"),
    });
  });
});

describe("FailedJobsWatch", () => {
  function setUp(rows: FailedJobNeedsReviewGroup[][], stored = EMPTY_ALERT_STATE) {
    const raised: [string, Record<string, unknown>][] = [];
    let state: FailedJobsAlertState = stored;
    const sources = rows.map((result) => ({ needsReviewGroups: vi.fn(async () => result) }));
    const watch = new FailedJobsWatch({
      sources,
      state: {
        read: async () => state,
        write: async (next) => {
          state = next;
        },
      },
      alerts: { raise: (alert, details) => void raised.push([alert.message, { ...details }]) },
      config: FAILED_JOBS_ALERT_DEFAULTS,
      now: () => NOW,
    });
    return { watch, raised, sources, state: () => state };
  }

  it("asks every source for the last 24 hours and raises one alert naming the group", async () => {
    const { watch, raised, sources } = setUp([
      [row({ count: 49, newSince: 12 })],
      [row({ jobType: "send-email", jobName: null, errorLine: "timeout", count: 2 })],
    ]);
    await watch.check();
    for (const source of sources) {
      expect(source.needsReviewGroups).toHaveBeenCalledWith(new Date(NOW.getTime() - 24 * HOUR));
    }
    expect(raised).toHaveLength(1);
    const [message, details] = raised[0] ?? [];
    expect(message).toBe(FAILED_JOBS_ALERTS.growing.message);
    expect(details).toEqual({
      total: 51,
      totalNewInWindow: 12,
      totalGrew: false,
      groups: [
        {
          jobType: "delivery:zoho",
          job: "user.registered to zoho",
          errorCode: "ZOHO_INVALID_DATA",
          count: 49,
          newInWindow: 12,
          firstSeen: "2026-10-28T09:00:00.000Z",
          lastSeen: "2026-11-12T09:00:00.000Z",
          reasons: ["grew"],
          page: "/admin/failed-jobs?view=needs_review&queue=delivery%3Azoho",
        },
      ],
      moreGroups: 0,
      page: "/admin/failed-jobs?view=needs_review",
    });
    // Nothing from the error text or a payload leaves with the alert.
    expect(JSON.stringify(details)).not.toMatch(/lena|north|not valid/);
  });

  it("keeps what it alerted, so the next run is quiet until the group grows", async () => {
    const first = setUp([[row({ count: 49, newSince: 12 })]]);
    await first.watch.check();
    const again = setUp([[row({ count: 49, newSince: 12 })]], first.state());
    expect(await again.watch.check()).toBeNull();
    expect(again.raised).toEqual([]);
  });

  it("lists at most 10 groups and counts the rest", async () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      row({ jobType: `queue-${index}`, jobName: null, count: 1, newSince: 1, firstFailedAt: NOW }),
    );
    const { watch, raised } = setUp([rows]);
    await watch.check();
    const details = raised[0]?.[1] as { groups: unknown[]; moreGroups: number };
    expect(details.groups).toHaveLength(10);
    expect(details.moreGroups).toBe(2);
  });
});

describe("RedisFailedJobsAlertState", () => {
  it("writes the state under one key with an expiry, and reads it back", async () => {
    const store = new Map<string, string>();
    const set = vi.fn(async (key: string, value: string) => void store.set(key, value));
    const state = new RedisFailedJobsAlertState({
      get: async (key) => store.get(key) ?? null,
      set,
    });
    expect(await state.read()).toEqual(EMPTY_ALERT_STATE);
    const next = {
      groups: { a: { count: 3, alertedAt: NOW.toISOString() } },
      total: { count: 30, alertedAt: NOW.toISOString() },
    };
    await state.write(next);
    expect(set).toHaveBeenCalledWith(
      FAILED_JOBS_ALERT_STATE_KEY,
      JSON.stringify(next),
      "EX",
      2_592_000,
    );
    expect(await state.read()).toEqual(next);
  });

  it("starts afresh from anything it cannot read, keeping well-formed marks", () => {
    expect(parseAlertState("not json")).toEqual(EMPTY_ALERT_STATE);
    expect(
      parseAlertState(
        JSON.stringify({
          groups: { a: { count: 1, alertedAt: "2026-11-01T00:00:00Z" }, b: { count: "x" } },
          total: { count: 2 },
        }),
      ),
    ).toEqual({ groups: { a: { count: 1, alertedAt: "2026-11-01T00:00:00Z" } }, total: null });
  });
});
