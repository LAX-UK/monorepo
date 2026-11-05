import { afterAll, beforeAll, vi } from "vitest";

/**
 * Freezes the date at 5 Nov 2026 for a test file. Staff dates drop the year when it is the current
 * one, so a test that reads dates must not depend on the day it runs.
 */
export function pinClock(): void {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-05T12:00:00.000Z"));
  });
  afterAll(() => {
    vi.useRealTimers();
  });
}
