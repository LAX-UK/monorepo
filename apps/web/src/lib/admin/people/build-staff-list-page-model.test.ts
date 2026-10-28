import { buildStaffListPageModel } from "@/lib/admin/people/build-staff-list-page-model";
import { describe, expect, it } from "vitest";

describe("buildStaffListPageModel", () => {
  it("fixes role=staff and preserves preview drawer param", () => {
    const model = buildStaffListPageModel({
      q: "bob",
      staffRole: "finance",
      offset: "0",
      limit: "25",
      staff: "staff-123",
    });

    expect(model.listQueryParams).toMatchObject({
      limit: 25,
      offset: 0,
      role: "staff",
      q: "bob",
      staffRole: "finance",
    });
    expect(model.selectedStaffId).toBe("staff-123");
    expect(model.buildDrawerHref("staff-456")).toContain("staff=staff-456");
    expect(model.buildDrawerHref(null)).not.toContain("staff=");
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
