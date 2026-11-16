import type { Metadata } from "next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { salesBrowsePageMetadata } from "./sales-browse-page.seo";

/** The canonical address's path and query (the origin depends on the environment). */
function canonicalPath(meta: Metadata): string {
  const url = new URL(String(meta.alternates?.canonical));
  return `${url.pathname}${url.search}`;
}

describe("salesBrowsePageMetadata", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_FORCE_INDEXING", "visible");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the unfiltered calendar indexable, with canonical /sales", () => {
    for (const sp of [{}, { tab: "upcoming" }, { tab: "results", view: "list" }, { page: "2" }]) {
      const meta = salesBrowsePageMetadata(sp);
      expect(canonicalPath(meta)).toBe("/sales");
      expect(meta.robots).not.toEqual({ index: false, follow: true });
    }
  });

  it.each([
    ["categoryId", "cat-1"],
    ["delivery", "online"],
    ["location", "london"],
    ["sort", "createdDesc"],
    ["month", "12"],
    ["year", "2026"],
    ["minPrice", "1000"],
    ["maxPrice", "5000"],
  ])("gives a %s address noindex, follow and canonical /sales", (key, value) => {
    const meta = salesBrowsePageMetadata({ tab: "upcoming", [key]: value });
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(canonicalPath(meta)).toBe("/sales");
  });

  it("ignores an empty filter param", () => {
    expect(salesBrowsePageMetadata({ categoryId: "" }).robots).not.toEqual({
      index: false,
      follow: true,
    });
  });
});
