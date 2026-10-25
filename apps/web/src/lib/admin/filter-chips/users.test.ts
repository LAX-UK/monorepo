import { buildUsersActiveFilterChips } from "@/lib/admin/filter-chips/users";
import { describe, expect, it } from "vitest";

describe("buildUsersActiveFilterChips persona", () => {
  const basePath = "/admin/clients";

  it("uses registry labels for persona chips", () => {
    const chips = buildUsersActiveFilterChips(
      basePath,
      { persona: "individual" },
      {
        persona: "individual",
      },
    );
    expect(chips).toContainEqual(
      expect.objectContaining({ id: "persona", label: "Signed up as: Individual" }),
    );
  });

  it("maps none filter to Not set label", () => {
    const chips = buildUsersActiveFilterChips(
      basePath,
      { persona: "none" },
      {
        persona: "none",
      },
    );
    expect(chips).toContainEqual(
      expect.objectContaining({ id: "persona", label: "Signed up as: Not set" }),
    );
  });

  it("leaves the view's account standing and the sort out of the chips", () => {
    const chips = buildUsersActiveFilterChips(
      basePath,
      { status: "suspended", sort: "name_asc", kycStatus: "unverified" },
      { accountStatus: "suspended", sort: "name_asc", kycStatus: "unverified" },
    );
    expect(chips.map((chip) => chip.label)).toEqual(["Identity: Not verified"]);
  });
});
