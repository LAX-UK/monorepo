import { describe, expect, it } from "vitest";
import { resolveComplianceCapabilities } from "./resolve-compliance-capabilities";

describe("resolveComplianceCapabilities", () => {
  it("grants triage and decide to super_admin", () => {
    const caps = resolveComplianceCapabilities({ role: "staff", staffRole: "super_admin" });
    expect(caps.canTriage).toBe(true);
    expect(caps.canDecide).toBe(true);
  });

  it("denies capabilities to staff_viewer", () => {
    const caps = resolveComplianceCapabilities({ role: "staff", staffRole: "staff_viewer" });
    expect(caps.canTriage).toBe(false);
    expect(caps.canDecide).toBe(false);
  });

  it("grants triage and decide to compliance_officer", () => {
    const caps = resolveComplianceCapabilities({ role: "staff", staffRole: "compliance_officer" });
    expect(caps.canTriage).toBe(true);
    expect(caps.canDecide).toBe(true);
  });
});
