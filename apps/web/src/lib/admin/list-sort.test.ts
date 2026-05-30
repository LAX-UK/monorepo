import { describe, expect, it } from "vitest";
import { buildSortHref, sortDirectionForValue } from "./list-sort";

describe("buildSortHref", () => {
  it("sets sort and resets offset when inactive", () => {
    const href = buildSortHref("/admin/lots", { offset: "50", q: "vase" }, "endingAsc", undefined);
    const url = new URL(href, "http://local");
    expect(url.pathname).toBe("/admin/lots");
    expect(url.searchParams.get("q")).toBe("vase");
    expect(url.searchParams.get("sort")).toBe("endingAsc");
    expect(url.searchParams.get("offset")).toBe("0");
  });

  it("clears sort when clicking the active column", () => {
    expect(
      buildSortHref("/admin/lots", { sort: "endingAsc", offset: "50" }, "endingAsc", "endingAsc"),
    ).toBe("/admin/lots?offset=0");
  });
});

describe("sortDirectionForValue", () => {
  it("maps Asc suffix to ascending", () => {
    expect(sortDirectionForValue("endingAsc")).toBe("asc");
    expect(sortDirectionForValue("hammerDesc")).toBe("desc");
  });
});
