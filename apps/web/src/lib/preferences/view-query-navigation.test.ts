import {
  buildViewHref,
  buildViewQueryParams,
  salesBrowseViewCookieValue,
} from "@/lib/preferences/view-query-navigation";
import { describe, expect, it } from "vitest";

describe("buildViewQueryParams", () => {
  it("omits view param when next matches default (grid)", () => {
    const next = buildViewQueryParams("view=list&page=2", "grid", { defaultView: "grid" });
    expect(next.toString()).toBe("");
  });

  it("sets view param for non-default layout", () => {
    const next = buildViewQueryParams("page=2", "list", { defaultView: "grid" });
    expect(next.toString()).toBe("view=list");
  });

  it("clears pagination keys on view change", () => {
    const next = buildViewQueryParams("view=grid&page=3&offset=24", "list", {
      defaultView: "grid",
    });
    expect(next.toString()).toBe("view=list");
  });
});

describe("buildViewHref", () => {
  it("builds pathname-only href for default view", () => {
    expect(buildViewHref("/search", "view=list", "grid", { defaultView: "grid" })).toBe("/search");
  });

  it("builds href with view for sales list mode (non-URL-default)", () => {
    expect(buildViewHref("/sales", "", "list", { defaultView: "grid" })).toBe("/sales?view=list");
  });
});

describe("salesBrowseViewCookieValue", () => {
  it("maps calendar to grid for the sales preference cookie", () => {
    expect(salesBrowseViewCookieValue("calendar")).toBe("grid");
    expect(salesBrowseViewCookieValue("list")).toBe("list");
  });
});
