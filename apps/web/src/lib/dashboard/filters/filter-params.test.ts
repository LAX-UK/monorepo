import { describe, expect, it } from "vitest";
import {
  buildFilterHref,
  countActiveFilterDimensions,
  parseCommaSeparatedIds,
  serializeFilterParams,
} from "./filter-params";

describe("filter-params", () => {
  it("serializeFilterParams omits defaults", () => {
    expect(
      serializeFilterParams(
        { sort: "addedDesc", status: "active", q: "oil" },
        { omitDefaults: { sort: "addedDesc" } },
      ),
    ).toBe("status=active&q=oil");
  });

  it("buildFilterHref returns path only when empty", () => {
    expect(buildFilterHref("/watching", {}, { omitDefaults: { sort: "addedDesc" } })).toBe(
      "/watching",
    );
  });

  it("parseCommaSeparatedIds splits and trims", () => {
    expect(parseCommaSeparatedIds(" a, b ,c")).toEqual(["a", "b", "c"]);
  });

  it("countActiveFilterDimensions ignores defaults", () => {
    expect(
      countActiveFilterDimensions(
        { sort: "addedDesc", status: "active" },
        { sort: "addedDesc", status: undefined },
        ["sort", "status"],
      ),
    ).toBe(1);
  });
});
