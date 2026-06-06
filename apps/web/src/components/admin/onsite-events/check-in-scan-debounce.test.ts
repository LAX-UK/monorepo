import { describe, expect, it } from "vitest";
import {
  SCAN_COOLDOWN_MS,
  checkInInputKey,
  shouldDebounceSuccessfulScan,
  shouldSuppressRepeatScan,
} from "./check-in-scan-debounce";

describe("checkInInputKey", () => {
  it("keys token and rsvp scans separately", () => {
    expect(checkInInputKey({ token: "abc" })).toBe("token:abc");
    expect(checkInInputKey({ rsvpId: "id-1" })).toBe("rsvp:id-1");
  });
});

describe("shouldDebounceSuccessfulScan", () => {
  it("debounces only after successful admits", () => {
    expect(shouldDebounceSuccessfulScan("VALID")).toBe(true);
    expect(shouldDebounceSuccessfulScan("DRY_RUN_VALID")).toBe(true);
    expect(shouldDebounceSuccessfulScan("ALREADY_CHECKED_IN")).toBe(false);
    expect(shouldDebounceSuccessfulScan("INVALID")).toBe(false);
  });
});

describe("shouldSuppressRepeatScan", () => {
  const now = 10_000;

  it("suppresses repeat successful scan within cooldown", () => {
    expect(
      shouldSuppressRepeatScan({
        inputKey: "token:abc",
        lastKey: "token:abc",
        lastAt: now - 500,
        lastStatus: "VALID",
        now,
      }),
    ).toBe(true);
  });

  it("allows already-checked-in rescan within cooldown", () => {
    expect(
      shouldSuppressRepeatScan({
        inputKey: "token:abc",
        lastKey: "token:abc",
        lastAt: now - 500,
        lastStatus: "ALREADY_CHECKED_IN",
        now,
      }),
    ).toBe(false);
  });

  it("allows scan after cooldown elapses", () => {
    expect(
      shouldSuppressRepeatScan({
        inputKey: "token:abc",
        lastKey: "token:abc",
        lastAt: now - SCAN_COOLDOWN_MS,
        lastStatus: "VALID",
        now,
      }),
    ).toBe(false);
  });
});
