import { describe, expect, it } from "vitest";
import { bidStaffRoleLabel, staffRoleRefusalMessage } from "./staff-role-refusal.js";

describe("staffRoleRefusalMessage", () => {
  it("names both roles and the reason for a forbidden combination", () => {
    expect(
      staffRoleRefusalMessage({
        reason: "forbidden_combination",
        role: "compliance",
        conflictingRole: "finance",
      }),
    ).toBe(
      "Compliance can't be combined with Finance. Moving money and clearing compliance checks are kept with different people.",
    );
    expect(
      staffRoleRefusalMessage({
        reason: "forbidden_combination",
        role: "specialist",
        conflictingRole: "read_only",
      }),
    ).toBe(
      "Specialist can't be combined with Read-only. Read-only access stays read-only; any other role would widen it.",
    );
  });

  it("explains the last administrator, a duplicate and a past end date", () => {
    expect(staffRoleRefusalMessage({ reason: "last_administrator", role: "administrator" })).toBe(
      "They are the only administrator. Give someone else the administrator role first.",
    );
    expect(staffRoleRefusalMessage({ reason: "duplicate", role: "finance" })).toBe(
      "Finance is already one of their roles.",
    );
    expect(staffRoleRefusalMessage({ reason: "invalid_period", role: "finance" })).toBe(
      "Choose an end date after today.",
    );
  });

  it("labels Bid roles in sentence case", () => {
    expect(bidStaffRoleLabel("saleroom_clerk")).toBe("Saleroom clerk");
  });
});
