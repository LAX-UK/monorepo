import { describe, expect, it } from "vitest";
import { envSchema } from "../env.js";
import { FAILED_JOBS_ALERT_DEFAULTS } from "../ops/failed-jobs/failed-jobs-alert-decision.js";
import { failedJobsAlertConfig } from "./create-failed-jobs-watch.js";

const parse = (env: Record<string, string> = {}) => {
  const result = envSchema.safeParse({ DATABASE_URL: "postgres://localhost/test", ...env });
  if (!result.success) throw result.error;
  return result.data;
};

describe("Failed jobs alert config", () => {
  it("defaults to 10 per group, 25 in all, over 24 hours, quiet for 7 days", () => {
    expect(failedJobsAlertConfig(parse())).toEqual(FAILED_JOBS_ALERT_DEFAULTS);
  });

  it("takes each threshold from the worker env", () => {
    expect(
      failedJobsAlertConfig(
        parse({
          FAILED_JOBS_ALERT_GROUP_GROWTH: "5",
          FAILED_JOBS_ALERT_TOTAL_GROWTH: "40",
          FAILED_JOBS_ALERT_WINDOW_HOURS: "12",
          FAILED_JOBS_ALERT_REPEAT_DAYS: "3",
        }),
      ),
    ).toEqual({
      groupGrowth: 5,
      totalGrowth: 40,
      windowMs: 12 * 3_600_000,
      repeatAfterMs: 3 * 24 * 3_600_000,
    });
  });

  it("refuses a threshold of zero", () => {
    expect(() => parse({ FAILED_JOBS_ALERT_GROUP_GROWTH: "0" })).toThrow();
  });
});
