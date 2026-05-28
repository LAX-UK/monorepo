import { describe, expect, it } from "vitest";
import { REQUIREMENT_LABELS, labelForRequirement } from "./requirement-labels.js";

describe("REQUIREMENT_LABELS", () => {
  it("defines exact keys for common Stripe requirements", () => {
    expect(REQUIREMENT_LABELS.external_account?.label).toBe("Bank account");
    expect(REQUIREMENT_LABELS["tos_acceptance.date"]?.label).toBe("Terms acceptance");
    expect(REQUIREMENT_LABELS["individual.dob.day"]?.label).toBe("Date of birth");
    expect(REQUIREMENT_LABELS["company.verification.document"]?.label).toBe(
      "Company verification document",
    );
  });
});

describe("labelForRequirement", () => {
  it("returns exact labels for known keys", () => {
    expect(labelForRequirement("external_account").label).toBe("Bank account");
    expect(labelForRequirement("tos_acceptance.ip").label).toBe("Terms acceptance");
  });

  it("uses prefix fallbacks for unknown nested keys", () => {
    expect(labelForRequirement("individual.custom.field").label).toBe("Personal details");
    expect(labelForRequirement("company.custom.field").label).toBe("Business details");
    expect(labelForRequirement("representative.custom.field").label).toBe("Business details");
    expect(labelForRequirement("business_profile.custom").label).toBe("Business profile");
  });

  it("formats unknown keys with dot separators", () => {
    expect(labelForRequirement("custom.unknown.key").label).toBe("custom · unknown · key");
  });
});
