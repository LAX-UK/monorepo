import type { UserStaffRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import { SaleroomAccessClerkEligibility } from "./telephone-clerk-eligibility.js";

function eligibilityFor(row: { role: string; staffRoles: UserStaffRole[] } | null) {
  return new SaleroomAccessClerkEligibility(
    {
      findById: async () =>
        row
          ? {
              id: "u1",
              email: "u@example.com",
              name: "U",
              image: null,
              hasSeenActingContextTooltip: false,
              role: row.role,
              // The profile's single role is display only; access follows the assignments.
              staffRole: null,
            }
          : null,
    },
    { listActiveRoles: async () => row?.staffRoles ?? [] },
  );
}

describe("SaleroomAccessClerkEligibility", () => {
  it("accepts staff whose roles in force can run the saleroom", async () => {
    expect(
      await eligibilityFor({ role: "staff", staffRoles: ["administrator"] }).canTakeTelephoneLines(
        "u1",
      ),
    ).toBe(true);
  });

  it("rejects clients, unknown users and staff without saleroom access", async () => {
    expect(
      await eligibilityFor({ role: "client", staffRoles: [] }).canTakeTelephoneLines("u1"),
    ).toBe(false);
    expect(await eligibilityFor(null).canTakeTelephoneLines("u1")).toBe(false);
    expect(
      await eligibilityFor({ role: "staff", staffRoles: [] }).canTakeTelephoneLines("u1"),
    ).toBe(false);
  });
});
