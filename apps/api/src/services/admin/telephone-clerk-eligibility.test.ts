import { describe, expect, it } from "vitest";
import { SaleroomAccessClerkEligibility } from "./telephone-clerk-eligibility.js";

function eligibilityFor(row: { role: string; staffRole: string | null } | null) {
  return new SaleroomAccessClerkEligibility({
    findById: async () =>
      row
        ? {
            id: "u1",
            email: "u@example.com",
            name: "U",
            image: null,
            hasSeenActingContextTooltip: false,
            ...row,
          }
        : null,
  });
}

describe("SaleroomAccessClerkEligibility", () => {
  it("accepts staff who can run the saleroom", async () => {
    expect(
      await eligibilityFor({ role: "staff", staffRole: "super_admin" }).canTakeTelephoneLines("u1"),
    ).toBe(true);
  });

  it("rejects clients, unknown users and staff without saleroom access", async () => {
    expect(
      await eligibilityFor({ role: "client", staffRole: null }).canTakeTelephoneLines("u1"),
    ).toBe(false);
    expect(await eligibilityFor(null).canTakeTelephoneLines("u1")).toBe(false);
    expect(
      await eligibilityFor({ role: "staff", staffRole: null }).canTakeTelephoneLines("u1"),
    ).toBe(false);
  });
});
