import { describe, expect, it } from "vitest";
import { SELL_PAGE_TOC } from "./sell-page-toc";

/** LegalH2 ids on `/sell` — keep in sync with sell/page.tsx. */
const SELL_PAGE_SECTION_IDS = [
  "departments",
  "how-it-works",
  "prepare",
  "photos",
  "fees",
  "valuation",
] as const;

describe("SELL_PAGE_TOC", () => {
  it("has unique kebab-case ids", () => {
    const ids = SELL_PAGE_TOC.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("matches LegalH2 anchor ids on the sell page", () => {
    expect(SELL_PAGE_TOC.map((item) => item.id)).toEqual([...SELL_PAGE_SECTION_IDS]);
  });
});
