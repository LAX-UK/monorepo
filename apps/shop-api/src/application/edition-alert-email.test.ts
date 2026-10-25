import { describe, expect, it } from "vitest";
import { maskAlertEmail, normalizeAlertEmail } from "./edition-alert-email.js";

describe("edition alert email", () => {
  it("compares addresses without case or surrounding space", () => {
    expect(normalizeAlertEmail("  Ann.Lee@Example.COM ")).toBe("ann.lee@example.com");
  });

  it("keeps the first letter and the domain, and hides the rest", () => {
    expect(maskAlertEmail("robert@example.com")).toBe("r•••@example.com");
    expect(maskAlertEmail("a@b.co")).toBe("a•••@b.co");
    expect(maskAlertEmail("not-an-address")).toBe("•••");
  });
});
