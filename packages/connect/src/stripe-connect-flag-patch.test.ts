import { describe, expect, it } from "vitest";
import { buildStripeConnectFlagPatch } from "./stripe-connect-flag-patch.js";

describe("buildStripeConnectFlagPatch", () => {
  it("extracts connect flags and normalizes requirement errors", () => {
    const patch = buildStripeConnectFlagPatch({
      charges_enabled: true,
      payouts_enabled: false,
      requirements: {
        currently_due: ["company.verification.document"],
        disabled_reason: "requirements.past_due",
        errors: [
          {
            requirement: "company.verification.document",
            code: "verification_document_failed_greyscale",
            reason: "Greyscale documents cannot be read. Please upload a color copy.",
          },
        ],
      },
    });

    expect(patch).toEqual({
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: false,
      stripeConnectRequirementsCurrentlyDue: ["company.verification.document"],
      stripeConnectDisabledReason: "requirements.past_due",
      stripeConnectRequirementsErrors: [
        {
          requirement: "company.verification.document",
          code: "verification_document_failed_greyscale",
          reason: "Greyscale documents cannot be read. Please upload a color copy.",
        },
      ],
    });
  });

  it("defaults empty arrays when requirements missing", () => {
    const patch = buildStripeConnectFlagPatch({});
    expect(patch.stripeConnectRequirementsCurrentlyDue).toEqual([]);
    expect(patch.stripeConnectRequirementsErrors).toEqual([]);
    expect(patch.stripeConnectDisabledReason).toBeNull();
  });

  it("trims currently due keys and empty disabled reasons", () => {
    const patch = buildStripeConnectFlagPatch({
      requirements: {
        currently_due: [" external_account ", ""],
        disabled_reason: "   ",
      },
    });
    expect(patch.stripeConnectRequirementsCurrentlyDue).toEqual(["external_account"]);
    expect(patch.stripeConnectDisabledReason).toBeNull();
  });
});
