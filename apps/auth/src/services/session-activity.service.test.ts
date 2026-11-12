import { describe, expect, it, vi } from "vitest";
import { SessionActivity } from "./session-activity.service.js";
import { SESSION_LIFETIME_POLICY } from "./session-lifetime-policy.js";

const START = new Date("2026-11-11T12:00:00.000Z");

function setup() {
  let now = START.getTime();
  const touch = vi.fn(async () => true);
  const activity = new SessionActivity({ touch }, () => new Date(now));
  return {
    touch,
    activity,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("SessionActivity", () => {
  it("hands the store the policy's throttle", async () => {
    const { activity, touch } = setup();
    await activity.record("rec");
    expect(touch).toHaveBeenCalledWith("rec", START, SESSION_LIFETIME_POLICY.activityThrottleMs);
  });

  it("asks once per throttle window per record, and again after it", async () => {
    const { activity, touch, advance } = setup();
    await activity.record("rec");
    advance(SESSION_LIFETIME_POLICY.activityThrottleMs - 1);
    await activity.record("rec");
    expect(touch).toHaveBeenCalledTimes(1);

    advance(1);
    await activity.record("rec");
    expect(touch).toHaveBeenCalledTimes(2);
  });

  it("throttles each record on its own", async () => {
    const { activity, touch } = setup();
    await activity.record("a");
    await activity.record("b");
    expect(touch).toHaveBeenCalledTimes(2);
  });

  it("asks again at once after a failed write", async () => {
    const { activity, touch } = setup();
    touch.mockRejectedValueOnce(new Error("db down"));
    await expect(activity.record("rec")).rejects.toThrow("db down");
    await activity.record("rec");
    expect(touch).toHaveBeenCalledTimes(2);
  });
});
