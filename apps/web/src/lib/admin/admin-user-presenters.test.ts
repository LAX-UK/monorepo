import { userEmailStatuses, userKycStatuses } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  formatAmlCheckType,
  formatEmailDeliverabilityStatus,
  formatSignupPersona,
  formatUserRole,
  kycStatusPhrase,
} from "./admin-user-presenters";
import { EMAIL_DELIVERABILITY_LABELS, KYC_STATUS_PHRASES } from "./admin-user.copy";

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

describe("email deliverability labels", () => {
  it.each(userEmailStatuses)("labels %s in words", (status) => {
    expect(EMAIL_DELIVERABILITY_LABELS[status]).toMatch(/^[A-Z][a-z ]+$/);
    expect(formatEmailDeliverabilityStatus(status)).toBe(EMAIL_DELIVERABILITY_LABELS[status]);
  });

  it("reads an unknown value in sentence case", () => {
    expect(formatEmailDeliverabilityStatus("soft_bounce")).toBe("Soft bounce");
    expect(formatEmailDeliverabilityStatus(null)).toBe("Unknown");
  });
});

describe("kyc status phrases", () => {
  it.each([...userKycStatuses, "submitted", "under_review", "expired"])(
    "has a phrase for %s that is not the stored code",
    (status) => {
      expect(Object.keys(KYC_STATUS_PHRASES)).toContain(status);
      expect(kycStatusPhrase(status)).not.toContain("_");
      expect(kycStatusPhrase(status)).toBe(kycStatusPhrase(status).toLowerCase());
    },
  );
});
