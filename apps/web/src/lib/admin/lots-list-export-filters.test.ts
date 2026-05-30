import { describe, expect, it } from "vitest";
import { lotsListExportFilters } from "./lots-list-export-filters";

describe("lotsListExportFilters", () => {
  it("maps needsPhotos and sort", () => {
    const filters = lotsListExportFilters(
      {
        status: "draft",
        needsPhotos: true,
        limit: 50,
        offset: 0,
      },
      "createdDesc",
    );
    expect(filters).toEqual({
      status: "draft",
      needsPhotos: "1",
      sort: "createdDesc",
    });
  });

  it("omits empty optional fields", () => {
    expect(lotsListExportFilters({ limit: 50, offset: 0 })).toEqual({});
  });
});
