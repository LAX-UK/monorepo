import { describe, expect, it } from "vitest";
import { isNewDeviceEmailEnabled } from "./new-device-email-policy.js";

describe("isNewDeviceEmailEnabled", () => {
  it.each([
    ["production", "production", true],
    ["production", "test", true],
    ["development", "test", true],
    ["development", "development", false],
    ["test", "development", false],
  ] as const)("NODE_ENV=%s APP_ENV=%s -> %s", (NODE_ENV, APP_ENV, expected) => {
    expect(isNewDeviceEmailEnabled({ NODE_ENV, APP_ENV })).toBe(expected);
  });
});
