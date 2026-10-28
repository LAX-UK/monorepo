import { describe, expect, it } from "vitest";
import { resolveComplianceCapabilities } from "./resolve-compliance-capabilities";

describe("resolveComplianceCapabilities", () => {
  it("grants triage and decide to administrator", () => {
    const caps = resolveComplianceCapabilities({ role: "staff", staffRoles: ["administrator"] });
    expect(caps.canTriage).toBe(true);
    expect(caps.canDecide).toBe(true);
  });

  it("denies capabilities to read_only", () => {
    const caps = resolveComplianceCapabilities({ role: "staff", staffRoles: ["read_only"] });
    expect(caps.canTriage).toBe(false);
    expect(caps.canDecide).toBe(false);
  });

  it("grants triage and decide to compliance", () => {
    const caps = resolveComplianceCapabilities({
      role: "staff",
      staffRoles: ["compliance"],
    });
    expect(caps.canTriage).toBe(true);
    expect(caps.canDecide).toBe(true);
  });
});
