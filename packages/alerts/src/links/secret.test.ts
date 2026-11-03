import { describe, expect, it } from "vitest";
import { DEV_ALERT_LINK_SECRET, isUsableAlertLinkSecret } from "./secret.js";

describe("isUsableAlertLinkSecret", () => {
  it("refuses the development default, although it is long enough", () => {
    expect(DEV_ALERT_LINK_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(isUsableAlertLinkSecret(DEV_ALERT_LINK_SECRET)).toBe(false);
  });

  it("refuses a secret shorter than 32 characters", () => {
    expect(isUsableAlertLinkSecret("a".repeat(31))).toBe(false);
  });

  it("accepts a real secret of 32 characters or more", () => {
    expect(isUsableAlertLinkSecret("k".repeat(32))).toBe(true);
  });
});
