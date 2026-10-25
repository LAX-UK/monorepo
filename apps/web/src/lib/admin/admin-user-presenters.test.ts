import { describe, expect, it } from "vitest";
import {
  formatAmlCheckType,
  formatEmailDeliverabilityStatus,
  formatSignupPersona,
  formatUserRole,
  kycStatusPhrase,
} from "./admin-user-presenters";

describe("admin-user-presenters", () => {
  it("formats signup persona", () => {
    expect(formatSignupPersona("individual")).toBe("Individual");
    expect(formatSignupPersona("organisation")).toBe("Organisation");
    expect(formatSignupPersona(null)).toBe("Not set");
  });

  it("formats email deliverability", () => {
    expect(formatEmailDeliverabilityStatus("ok")).toBe("Delivering normally");
    expect(formatEmailDeliverabilityStatus("bounced")).toBe("Bounced");
    expect(formatEmailDeliverabilityStatus("complained")).toBe("Marked as spam");
  });

  it("formats user role", () => {
    expect(formatUserRole("client")).toBe("Client");
    expect(formatUserRole("staff")).toBe("Staff");
  });

  it("formats AML check type", () => {
    expect(formatAmlCheckType("initial_result")).toBe("Initial screening");
    expect(formatAmlCheckType(null)).toBe("—");
    expect(formatAmlCheckType("updated_result")).toBe("Ongoing monitoring");
    expect(formatAmlCheckType("enhanced")).toBe("Enhanced check");
    expect(formatAmlCheckType("manual_rescreen")).toBe("Manual rescreen");
  });

  it("formats KYC status phrases", () => {
    expect(kycStatusPhrase("under_review")).toBe("in review");
    expect(kycStatusPhrase("rejected")).toBe("rejected");
  });
});
