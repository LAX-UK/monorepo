import { buildSubmissionsListPageModel } from "@/lib/admin/submissions/build-submissions-list-page-model";
import { describe, expect, it } from "vitest";

describe("buildSubmissionsListPageModel", () => {
  it("defaults to awaiting queue with export filters", () => {
    const model = buildSubmissionsListPageModel({});
    expect(model.activeQueue).toBe("awaiting");
    expect(model.query.queue).toBe("awaiting");
    expect(model.exportFilters.queue).toBe("awaiting");
  });

  it("counts advanced filters", () => {
    const model = buildSubmissionsListPageModel({
      q: "vase",
      categoryId: "cat-1",
      qualityGaps: "1",
      assignedTo: "me",
      sort: "sla",
    });
    expect(model.advancedFilterCount).toBe(5);
    expect(model.hasListFilters).toBe(true);
  });
});
