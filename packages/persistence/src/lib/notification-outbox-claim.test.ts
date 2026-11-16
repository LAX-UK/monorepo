import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_OUTBOX_MAX_ATTEMPTS,
  NOTIFICATION_OUTBOX_RETRY_MAX_MS,
  notificationOutboxRetryDelayMs,
} from "./notification-outbox-claim.js";

describe("notificationOutboxRetryDelayMs", () => {
  it("claims a row that never failed straight away", () => {
    expect(notificationOutboxRetryDelayMs(0)).toBe(0);
  });

  it("doubles from 15 s and caps at 5 min", () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(notificationOutboxRetryDelayMs)).toEqual([
      15_000, 30_000, 60_000, 120_000, 240_000, 300_000, 300_000,
    ]);
    expect(notificationOutboxRetryDelayMs(40)).toBe(NOTIFICATION_OUTBOX_RETRY_MAX_MS);
  });

  it("spreads the ten attempts over more than the ten minutes the minute sweep gave", () => {
    let total = 0;
    for (let attempts = 1; attempts < NOTIFICATION_OUTBOX_MAX_ATTEMPTS; attempts++) {
      total += notificationOutboxRetryDelayMs(attempts);
    }
    expect(total).toBeGreaterThanOrEqual(10 * 60_000);
    expect(total).toBe(1_665_000);
  });
});
