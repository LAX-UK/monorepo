import { describe, expect, it } from "vitest";
import {
  STAFF_STEP_UP_MAX_AGE_SECONDS,
  STAFF_STEP_UP_REQUIRED,
  isRecentStaffAuthentication,
} from "./staff-step-up.js";

const NOW = 1_800_000_000;

describe("isRecentStaffAuthentication", () => {
  it("accepts a sign-in inside the window, including the boundary", () => {
    expect(isRecentStaffAuthentication({ authTimeSeconds: NOW - 10, nowSeconds: NOW })).toBe(true);
    expect(
      isRecentStaffAuthentication({
        authTimeSeconds: NOW - STAFF_STEP_UP_MAX_AGE_SECONDS,
        nowSeconds: NOW,
      }),
    ).toBe(true);
  });

  it("rejects an old, missing, non-finite or future sign-in", () => {
    expect(
      isRecentStaffAuthentication({
        authTimeSeconds: NOW - STAFF_STEP_UP_MAX_AGE_SECONDS - 1,
        nowSeconds: NOW,
      }),
    ).toBe(false);
    expect(isRecentStaffAuthentication({ authTimeSeconds: null, nowSeconds: NOW })).toBe(false);
    expect(isRecentStaffAuthentication({ authTimeSeconds: undefined, nowSeconds: NOW })).toBe(
      false,
    );
    expect(isRecentStaffAuthentication({ authTimeSeconds: Number.NaN, nowSeconds: NOW })).toBe(
      false,
    );
    expect(isRecentStaffAuthentication({ authTimeSeconds: NOW + 5, nowSeconds: NOW })).toBe(false);
  });

  it("honours a custom window", () => {
    expect(
      isRecentStaffAuthentication({
        authTimeSeconds: NOW - 100,
        nowSeconds: NOW,
        maxAgeSeconds: 60,
      }),
    ).toBe(false);
  });

  it("exposes the shared error code", () => {
    expect(STAFF_STEP_UP_REQUIRED).toBe("step_up_required");
  });
});
