import { buildStaffListPageModel } from "@/lib/admin/people/build-staff-list-page-model";
import { describe, expect, it } from "vitest";

describe("buildStaffListPageModel", () => {
  it("fixes role=staff", () => {
    const model = buildStaffListPageModel({
      q: "bob",
      staffRole: "finance",
      offset: "0",
      limit: "25",
    });

    expect(model.listQueryParams).toMatchObject({
      limit: 25,
      offset: 0,
      role: "staff",
      q: "bob",
      staffRole: "finance",
    });
  });

  it("forwards a valid sort and does not treat it as a filter", () => {
    const model = buildStaffListPageModel({ sort: "name_asc" });
    expect(model.listQueryParams.sort).toBe("name_asc");
    expect(model.hasFilters).toBe(false);
    expect(model.activeFilterCount).toBe(0);
    expect(model.activeFilterChips).toEqual([]);
  });

  it("ignores an unknown sort", () => {
    expect(buildStaffListPageModel({ sort: "bogus" }).listQueryParams).not.toHaveProperty("sort");
  });
});
