import { userStaffRoles } from "@auction/types";
import { describe, expect, it } from "vitest";
import { enquiryAbilities } from "./enquiry-access";

const abilities = (role: (typeof userStaffRoles)[number]) =>
  enquiryAbilities({ role: "staff", staffRoles: [role] });

describe("enquiryAbilities", () => {
  it("lets Administrator and Sales manager route, and nobody else", () => {
    for (const role of userStaffRoles) {
      expect(abilities(role).canRoute).toBe(role === "administrator" || role === "sales_manager");
    }
  });

  it("lets the roles that read enquiries work them", () => {
    for (const role of [
      "administrator",
      "sales_manager",
      "specialist",
      "client_services",
    ] as const) {
      expect(abilities(role).canWork).toBe(true);
    }
    for (const role of ["finance", "read_only", "compliance", "cataloguer"] as const) {
      expect(abilities(role).canWork).toBe(false);
    }
  });

  it("lands a specialist on their own queue and everyone else on what is open", () => {
    expect(abilities("specialist").defaultView).toBe("assigned_to_me");
    for (const role of ["administrator", "sales_manager", "client_services"] as const) {
      expect(abilities(role).defaultView).toBe("open");
    }
  });
});
