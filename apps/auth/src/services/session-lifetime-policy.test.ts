import { describe, expect, it } from "vitest";
import {
  SESSION_LIFETIME_POLICY,
  type SessionTimes,
  chooseEvictions,
  clampExpiry,
  lifetimeFor,
  sessionEndReason,
} from "./session-lifetime-policy.js";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = new Date("2026-11-11T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const inFuture = (ms: number) => new Date(NOW.getTime() + ms);

function times(over: Partial<SessionTimes> = {}): SessionTimes {
  return {
    expiresAt: inFuture(DAY),
    lastActiveAt: ago(HOUR),
    signedInAt: ago(HOUR),
    ...over,
  };
}

describe("session lifetime policy", () => {
  it("states every length in one place", () => {
    expect(SESSION_LIFETIME_POLICY).toEqual({
      client: { idleMs: 7 * DAY, absoluteMs: 30 * DAY, maxBrowsers: 20 },
      staff: { idleMs: 12 * HOUR, absoluteMs: 24 * HOUR, maxBrowsers: 5 },
      activityThrottleMs: 15 * 60_000,
    });
    expect(lifetimeFor(true)).toBe(SESSION_LIFETIME_POLICY.staff);
    expect(lifetimeFor(false)).toBe(SESSION_LIFETIME_POLICY.client);
  });
});

describe("sessionEndReason", () => {
  it("keeps a record that is within every limit", () => {
    expect(sessionEndReason(times(), false, NOW)).toBeNull();
    expect(sessionEndReason(times(), true, NOW)).toBeNull();
  });

  it("ends a client after 7 days idle, at that instant and not before", () => {
    const justInside = times({ lastActiveAt: ago(7 * DAY - 1), expiresAt: inFuture(DAY) });
    const atLimit = times({ lastActiveAt: ago(7 * DAY), expiresAt: inFuture(DAY) });
    expect(sessionEndReason(justInside, false, NOW)).toBeNull();
    expect(sessionEndReason(atLimit, false, NOW)).toBe("idle");
  });

  it("ends a client 30 days after first sign-in however recently it was used", () => {
    const used = times({ signedInAt: ago(30 * DAY), lastActiveAt: ago(1_000) });
    expect(sessionEndReason(used, false, NOW)).toBe("absolute");
    expect(sessionEndReason({ ...used, signedInAt: ago(30 * DAY - 1) }, false, NOW)).toBeNull();
  });

  it("ends staff after 12 hours idle and 24 hours absolute, where a client would stay", () => {
    const idle = times({ lastActiveAt: ago(12 * HOUR) });
    expect(sessionEndReason(idle, true, NOW)).toBe("idle");
    expect(sessionEndReason(idle, false, NOW)).toBeNull();

    const old = times({ signedInAt: ago(24 * HOUR), lastActiveAt: ago(60_000) });
    expect(sessionEndReason(old, true, NOW)).toBe("absolute");
    expect(sessionEndReason(old, false, NOW)).toBeNull();
  });

  it("ends a record whose own expiry passed, whoever it is", () => {
    expect(sessionEndReason(times({ expiresAt: NOW }), false, NOW)).toBe("expired");
    expect(sessionEndReason(times({ expiresAt: ago(1) }), true, NOW)).toBe("expired");
  });
});

describe("chooseEvictions", () => {
  const live = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `s${String(i).padStart(2, "0")}`,
      lastActiveAt: ago((count - i) * HOUR),
    }));

  it("ends nothing at or under the cap", () => {
    expect(chooseEvictions(live(20), "s19", 20)).toEqual([]);
    expect(chooseEvictions(live(3), "s02", 20)).toEqual([]);
  });

  it("ends the least recently used record when the new sign-in goes over the cap", () => {
    expect(chooseEvictions(live(21), "s20", 20)).toEqual(["s00"]);
  });

  it("ends the several least recently used when several are over, oldest first", () => {
    expect(chooseEvictions(live(8), "s07", 5)).toEqual(["s00", "s01", "s02"]);
  });

  it("never ends the sign-in that just happened, even when it is the least recently used", () => {
    const held = [
      { id: "new", lastActiveAt: ago(30 * DAY) },
      { id: "a", lastActiveAt: ago(2 * HOUR) },
      { id: "b", lastActiveAt: ago(HOUR) },
    ];
    expect(chooseEvictions(held, "new", 2)).toEqual(["a"]);
  });

  it("breaks ties by id so the choice is the same on every instance", () => {
    const at = ago(HOUR);
    const held = [
      { id: "c", lastActiveAt: at },
      { id: "a", lastActiveAt: at },
      { id: "b", lastActiveAt: at },
      { id: "keep", lastActiveAt: NOW },
    ];
    expect(chooseEvictions(held, "keep", 2)).toEqual(["a", "b"]);
  });
});

describe("clampExpiry", () => {
  const week = inFuture(7 * DAY);

  it("leaves what Better Auth proposed alone while it is inside both limits", () => {
    const proposed = inFuture(6 * DAY);
    expect(clampExpiry(proposed, { lastActiveAt: ago(HOUR), signedInAt: ago(DAY) }, false)).toEqual(
      proposed,
    );
  });

  it("holds a client to 30 days from first sign-in and to 7 days from last use", () => {
    expect(
      clampExpiry(week, { lastActiveAt: ago(HOUR), signedInAt: ago(29 * DAY) }, false),
    ).toEqual(inFuture(DAY));
    expect(
      clampExpiry(inFuture(30 * DAY), { lastActiveAt: ago(2 * DAY), signedInAt: ago(DAY) }, false),
    ).toEqual(inFuture(5 * DAY));
  });

  it("holds staff to 24 hours from first sign-in and to 12 hours from last use", () => {
    expect(
      clampExpiry(week, { lastActiveAt: ago(HOUR), signedInAt: ago(23 * HOUR) }, true),
    ).toEqual(inFuture(HOUR));
    expect(
      clampExpiry(week, { lastActiveAt: ago(11 * HOUR), signedInAt: ago(HOUR) }, true),
    ).toEqual(inFuture(HOUR));
  });

  it("gives a time that has passed once a limit is reached, which Better Auth's own check refuses", () => {
    const over = clampExpiry(week, { lastActiveAt: ago(HOUR), signedInAt: ago(30 * DAY) }, false);
    expect(over.getTime()).toBeLessThanOrEqual(NOW.getTime());
    expect(sessionEndReason({ ...times(), expiresAt: over }, false, NOW)).toBe("expired");
  });
});
