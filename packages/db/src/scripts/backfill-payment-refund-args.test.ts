import { describe, expect, it } from "vitest";
import {
  MAX_LOCK_TIMEOUT_MS,
  parseBackfillArgs,
  parseDuration,
} from "./backfill-payment-refund-args.js";

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("parseDuration", () => {
  it("reads ms, s, m and bare milliseconds", () => {
    expect(parseDuration("500ms")).toBe(500);
    expect(parseDuration("5s")).toBe(5000);
    expect(parseDuration("1m")).toBe(60_000);
    expect(parseDuration("250")).toBe(250);
    expect(parseDuration("0")).toBe(0);
    expect(parseDuration(` ${MAX_LOCK_TIMEOUT_MS}`)).toBe(MAX_LOCK_TIMEOUT_MS);
  });

  it("rejects non-durations and values above the Postgres maximum", () => {
    for (const bad of ["", "abc", "-1s", "1.5s", "5h", "3000000000", "99999999999m"]) {
      expect(() => parseDuration(bad), bad).toThrow();
    }
    expect(() => parseDuration(String(MAX_LOCK_TIMEOUT_MS + 1))).toThrow(/too large/);
  });
});

describe("parseBackfillArgs", () => {
  it("uses defaults for a dry run with no flags", () => {
    expect(parseBackfillArgs([])).toEqual({
      apply: false,
      batchSize: 200,
      lockTimeoutMs: 5000,
      resumeAfter: null,
    });
  });

  it("accepts valid flags", () => {
    expect(
      parseBackfillArgs([
        "--apply",
        "--batch-size=50",
        "--lock-timeout=10s",
        `--resume-after=${ID}`,
      ]),
    ).toEqual({ apply: true, batchSize: 50, lockTimeoutMs: 10_000, resumeAfter: ID });
    expect(parseBackfillArgs(["--lock-timeout=0"]).lockTimeoutMs).toBe(0);
  });

  it("rejects present-but-empty flags", () => {
    for (const flag of ["--lock-timeout=", "--batch-size=", "--resume-after="]) {
      expect(() => parseBackfillArgs(["--apply", flag]), flag).toThrow();
    }
  });

  it("rejects out-of-range values", () => {
    for (const flag of [
      "--lock-timeout=2147483648",
      "--lock-timeout=3000000000",
      "--batch-size=0",
      "--batch-size=-5",
      "--batch-size=1.5",
      "--batch-size=abc",
      "--batch-size=9007199254740993",
    ]) {
      expect(() => parseBackfillArgs([flag]), flag).toThrow();
    }
  });

  it("rejects a resume cursor that is not a uuid", () => {
    expect(() => parseBackfillArgs(["--resume-after=not-a-uuid"])).toThrow(/uuid/);
  });
});
