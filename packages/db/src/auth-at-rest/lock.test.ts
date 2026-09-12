import { describe, expect, it, vi } from "vitest";
import {
  AUTH_AT_REST_BACKFILL_LOCK_KEY,
  releaseAuthAtRestLock,
  tryAcquireAuthAtRestLock,
} from "./lock.js";

describe("auth at-rest advisory lock", () => {
  it("uses a PostgreSQL signed-bigint key and the same value for acquire/release", async () => {
    expect(AUTH_AT_REST_BACKFILL_LOCK_KEY).toBeGreaterThanOrEqual(-(2n ** 63n));
    expect(AUTH_AT_REST_BACKFILL_LOCK_KEY).toBeLessThanOrEqual(2n ** 63n - 1n);

    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockResolvedValueOnce({ rows: [] });
    expect(await tryAcquireAuthAtRestLock({ query })).toBe(true);
    await releaseAuthAtRestLock({ query });

    const expected = [AUTH_AT_REST_BACKFILL_LOCK_KEY.toString()];
    expect(query.mock.calls[0]?.[1]).toEqual(expected);
    expect(query.mock.calls[1]?.[1]).toEqual(expected);
  });
});
