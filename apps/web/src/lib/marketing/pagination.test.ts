import { buildMarketingPageWindow, deriveHasMorePage } from "@/lib/marketing/pagination";
import { describe, expect, it } from "vitest";

describe("marketing pagination helpers", () => {
  it("derives hasMore from limit-plus-one rows", () => {
    const page = deriveHasMorePage([1, 2, 3], 2);

    expect(page.items).toEqual([1, 2]);
    expect(page.hasMore).toBe(true);
  });

  it("builds a compact page window with a trailing page", () => {
    const window = buildMarketingPageWindow({
      currentPage: 4,
      totalPages: 9,
      getPageHref: (page) => `/items?page=${page}`,
    });

    expect(window.pages).toEqual([
      { page: 3, href: "/items?page=3", current: false },
      { page: 4, href: "/items?page=4", current: true },
      { page: 5, href: "/items?page=5", current: false },
    ]);
    expect(window.showEllipsis).toBe(true);
    expect(window.trailingPage).toEqual({ page: 9, href: "/items?page=9" });
  });
});
