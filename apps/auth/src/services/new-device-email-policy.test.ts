import { describe, expect, it } from "vitest";
import { isNewDeviceEmailEnabled } from "./new-device-email-policy.js";

describe("isNewDeviceEmailEnabled", () => {
  it.each([
    ["production", "production", true],
    // A deployed image always runs NODE_ENV=production; APP_ENV left at its default.
    ["production", "development", true],
    // The test site: no recipient restriction exists in this repo, so it stays off by default.
    ["production", "test", false],
    ["development", "test", false],
    ["development", "development", false],
    ["test", "development", false],
  ] as const)("NODE_ENV=%s APP_ENV=%s -> %s", (NODE_ENV, APP_ENV, expected) => {
    expect(isNewDeviceEmailEnabled({ NODE_ENV, APP_ENV })).toBe(expected);
  });

  it.each([
    ["production", "production", false, false],
    ["production", "test", true, true],
    ["development", "development", true, true],
  ] as const)(
    "NEW_DEVICE_EMAIL_ENABLED decides when set (NODE_ENV=%s APP_ENV=%s flag=%s -> %s)",
    (NODE_ENV, APP_ENV, NEW_DEVICE_EMAIL_ENABLED, expected) => {
      expect(isNewDeviceEmailEnabled({ NODE_ENV, APP_ENV, NEW_DEVICE_EMAIL_ENABLED })).toBe(
        expected,
      );
    },
  );
});
