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
      expect.objectContaining({ id: "persona", label: "Persona: Individual" }),
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
      expect.objectContaining({ id: "persona", label: "Persona: Not set" }),
    );
  });
});
