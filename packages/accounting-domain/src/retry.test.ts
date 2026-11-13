import { describe, expect, it } from "vitest";
import {
  MAX_SEND_ATTEMPTS,
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_DELAY_MS,
  attemptsExhausted,
  retryDelayMs,
} from "./retry.js";

describe("retry schedule", () => {
  it("doubles from 30 seconds and stops at 30 minutes", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(retryDelayMs)).toEqual([
      30_000, 60_000, 120_000, 240_000, 480_000, 960_000, 1_800_000, 1_800_000,
    ]);
    expect(retryDelayMs(10_000)).toBe(RETRY_MAX_DELAY_MS);
  });

  it("treats nonsense attempt counts as the first wait", () => {
    for (const n of [0, -3, 1.5, Number.NaN]) expect(retryDelayMs(n)).toBe(RETRY_BASE_DELAY_MS);
  });

  it("hands a document to a person once every attempt is used", () => {
    expect(attemptsExhausted(MAX_SEND_ATTEMPTS - 1)).toBe(false);
    expect(attemptsExhausted(MAX_SEND_ATTEMPTS)).toBe(true);
  });
});
