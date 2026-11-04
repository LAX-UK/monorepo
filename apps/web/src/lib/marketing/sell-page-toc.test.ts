import { describe, expect, it } from "vitest";
import { legacySellAnchorTarget } from "./sell-legacy-anchors";
import { SELL_PAGE_TOC } from "./sell-page-toc";

/** LegalH2 ids on `/sell/how-to-sell` — keep in sync with sell/how-to-sell/page.tsx. */
const HOW_TO_SELL_SECTION_IDS = ["how-it-works", "prepare", "photos", "valuation"] as const;

describe("SELL_PAGE_TOC", () => {
  it("has unique kebab-case ids", () => {
    const ids = SELL_PAGE_TOC.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("matches LegalH2 anchor ids on the how to sell page", () => {
    expect(SELL_PAGE_TOC.map((item) => item.id)).toEqual([...HOW_TO_SELL_SECTION_IDS]);
  });
});

describe("legacySellAnchorTarget", () => {
  it("moves the sections that left /sell to the guide", () => {
    expect(legacySellAnchorTarget("#prepare")).toBe("/sell/how-to-sell#prepare");
    expect(legacySellAnchorTarget("#photos")).toBe("/sell/how-to-sell#photos");
    expect(legacySellAnchorTarget("#valuation")).toBe("/sell/how-to-sell#valuation");
  });

  it("leaves the sections that stayed on /sell where they are", () => {
    expect(legacySellAnchorTarget("#departments")).toBeNull();
    expect(legacySellAnchorTarget("#how-it-works")).toBeNull();
    expect(legacySellAnchorTarget("#fees")).toBeNull();
    expect(legacySellAnchorTarget("")).toBeNull();
  });
});
