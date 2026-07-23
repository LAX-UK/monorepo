import { buildDisputesListPageModel } from "@/lib/admin/build-disputes-list-page-model";
import { describe, expect, it } from "vitest";

describe("buildDisputesListPageModel", () => {
  it("builds URL-owned status chips and query params", () => {
    const model = buildDisputesListPageModel({
      status: "open",
      limit: "25",
      offset: "50",
    });

    expect(model.listQueryParams).toEqual({ status: "open", limit: 25, offset: 50 });
    expect(model.statusChipSpecs.find((chip) => chip.id === "open")?.active).toBe(true);
    expect(model.hasFilters).toBe(true);
  });
});
