import { buildStaffListPageModel } from "@/lib/admin/people/build-staff-list-page-model";
import { describe, expect, it } from "vitest";

describe("buildStaffListPageModel", () => {
  it("fixes role=staff and preserves preview drawer param", () => {
    const model = buildStaffListPageModel({
      q: "bob",
      staffRole: "finance_ops",
      offset: "0",
      limit: "25",
      staff: "staff-123",
    });

    expect(model.listQueryParams).toMatchObject({
      limit: 25,
      offset: 0,
      role: "staff",
      q: "bob",
      staffRole: "finance_ops",
    });
    expect(model.selectedStaffId).toBe("staff-123");
    expect(model.buildDrawerHref("staff-456")).toContain("staff=staff-456");
    expect(model.buildDrawerHref(null)).not.toContain("staff=");
  });
});
