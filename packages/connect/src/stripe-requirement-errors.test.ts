import { describe, expect, it } from "vitest";
import {
  mergeRequirementKeys,
  normalizeStripeRequirementErrors,
  resolveRequirementPresentation,
} from "./stripe-requirement-errors.js";

describe("normalizeStripeRequirementErrors", () => {
  it("keeps valid error entries", () => {
    const errors = normalizeStripeRequirementErrors([
      {
        requirement: "company.tax_id",
        code: "invalid_tax_id_format",
        reason: "Tax IDs must be a unique set of 9 numbers without dashes.",
      },
    ]);
    expect(errors).toEqual([
      {
        requirement: "company.tax_id",
        code: "invalid_tax_id_format",
        reason: "Tax IDs must be a unique set of 9 numbers without dashes.",
      },
    ]);
  });

  it("drops malformed entries", () => {
    expect(normalizeStripeRequirementErrors([{ requirement: "x" }])).toEqual([]);
    expect(normalizeStripeRequirementErrors(null)).toEqual([]);
  });
});

describe("mergeRequirementKeys", () => {
  it("unions currently due and error requirements", () => {
    const keys = mergeRequirementKeys(
      ["external_account"],
      [{ requirement: "company.tax_id", code: "x", reason: "y" }],
    );
    expect(keys).toEqual(["external_account", "company.tax_id"]);
  });
});

describe("resolveRequirementPresentation", () => {
  it("uses Stripe reason as hint when present", () => {
    const label = resolveRequirementPresentation("company.tax_id", [
      {
        requirement: "company.tax_id",
        code: "invalid_tax_id_format",
        reason: "Tax IDs must be a unique set of 9 numbers without dashes.",
      },
    ]);
    expect(label.label).toBe("Company tax ID");
    expect(label.hint).toBe("Tax IDs must be a unique set of 9 numbers without dashes.");
  });

  it("falls back to mapped hint when no matching error", () => {
    const label = resolveRequirementPresentation("external_account", []);
    expect(label.label).toBe("Bank account");
    expect(label.hint).toContain("UK bank account");
  });

  it("matches errors when requirement keys differ only by whitespace", () => {
    const label = resolveRequirementPresentation("company.tax_id", [
      {
        requirement: " company.tax_id ",
        code: "invalid_tax_id_format",
        reason: "Tax IDs must be a unique set of 9 numbers without dashes.",
      },
    ]);
    expect(label.hint).toBe("Tax IDs must be a unique set of 9 numbers without dashes.");
  });

  it("joins multiple Stripe reasons for the same requirement", () => {
    const label = resolveRequirementPresentation("company.tax_id", [
      {
        requirement: "company.tax_id",
        code: "invalid_tax_id_format",
        reason: "First message.",
      },
      {
        requirement: "company.tax_id",
        code: "invalid_tax_id",
        reason: "Second message.",
      },
    ]);
    expect(label.hint).toBe("First message. Second message.");
  });
});
