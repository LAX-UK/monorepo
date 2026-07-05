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

  it("labels Stripe Person-scoped requirement keys", () => {
    expect(labelForRequirement("person_1N9XNb2eZvKYlo2CjPX7xF6B.first_name").label).toBe(
      "Representative first name",
    );
    expect(labelForRequirement("person_1N9XNb2eZvKYlo2CjPX7xF6B.verification.document").label).toBe(
      "Representative ID",
    );
    expect(labelForRequirement("person_1N9XNb2eZvKYlo2CjPX7xF6B.proof_of_liveness").label).toBe(
      "Identity verification (liveness)",
    );
    expect(labelForRequirement("person_1N9XNb2eZvKYlo2CjPX7xF6B.address.*").label).toBe(
      "Business representative details",
    );
  });

  it("labels account-level keys from Stripe verification examples", () => {
    expect(labelForRequirement("business_type").label).toBe("Business type");
    expect(
      labelForRequirement("documents.proof_of_ultimate_beneficial_ownership.files").label,
    ).toBe("Beneficial ownership document");
  });
});
