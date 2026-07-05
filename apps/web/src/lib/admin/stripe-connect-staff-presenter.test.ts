import { describe, expect, it } from "vitest";
import {
  collectStripeTechnicalIds,
  presentStripeConnectAccount,
  presentStripeDisabledReason,
  presentStripeRequirement,
  presentStripeRequirementsForEntity,
} from "./stripe-connect-staff-presenter";

describe("stripe-connect-staff-presenter", () => {
  it("presents demo connect account without exposing raw id in primary", () => {
    const ref = presentStripeConnectAccount("acct_seed_cedar_needs_info");
    expect(ref?.primary).toBe("Demo Connect account · Cedar");
    expect(ref?.secondary).toBe("Verification details needed");
    expect(ref?.technicalValue).toBe("acct_seed_cedar_needs_info");
  });

  it("prefers Stripe reason as secondary when error exists", () => {
    const ref = presentStripeRequirement("company.tax_id", [
      {
        requirement: "company.tax_id",
        code: "invalid_tax_id_format",
        reason: "Tax IDs must be a unique set of 9 numbers without dashes.",
      },
    ]);
    expect(ref.primary).toBe("Company tax ID");
    expect(ref.secondary).toBe("Tax IDs must be a unique set of 9 numbers without dashes.");
  });

  it("presents disabled reason with friendly copy", () => {
    const ref = presentStripeDisabledReason("requirements.past_due");
    expect(ref?.primary).toBe("Overdue payout details");
    expect(ref?.technicalValue).toBe("requirements.past_due");
  });

  it("collects technical ids including error codes", () => {
    const items = collectStripeTechnicalIds({
      stripeConnectAccountId: "acct_seed_cedar_needs_info",
      stripeConnectRequirementsCurrentlyDue: ["external_account"],
      stripeConnectRequirementsErrors: [
        {
          requirement: "external_account",
          code: "invalid_stripe_id",
          reason: "Invalid bank account.",
        },
      ],
      stripeConnectDisabledReason: "requirements.past_due",
    });
    expect(items.some((i) => i.value === "invalid_stripe_id")).toBe(true);
    expect(items.some((i) => i.value === "acct_seed_cedar_needs_info")).toBe(true);
  });

  it("merges currently due and error-only requirements for entity list", () => {
    const items = presentStripeRequirementsForEntity({
      stripeConnectRequirementsCurrentlyDue: ["external_account"],
      stripeConnectRequirementsErrors: [
        {
          requirement: "company.tax_id",
          code: "invalid_tax_id_format",
          reason: "Tax IDs must be a unique set of 9 numbers without dashes.",
        },
      ],
    });
    expect(items).toHaveLength(2);
    expect(items[1]?.secondary).toContain("Tax IDs must");
  });

  it("collects technical ids including error-only requirement keys", () => {
    const items = collectStripeTechnicalIds({
      stripeConnectAccountId: null,
      stripeConnectRequirementsCurrentlyDue: [],
      stripeConnectRequirementsErrors: [
        {
          requirement: "company.tax_id",
          code: "invalid_tax_id_format",
          reason: "Tax IDs must be a unique set of 9 numbers without dashes.",
        },
      ],
      stripeConnectDisabledReason: null,
    });
    expect(items.some((i) => i.value === "company.tax_id")).toBe(true);
    expect(items.some((i) => i.value === "invalid_tax_id_format")).toBe(true);
  });
});
