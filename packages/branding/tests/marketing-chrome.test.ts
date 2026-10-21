import { describe, expect, it } from "vitest";
import {
  MARKETING_CATALOG_GUTTER,
  MARKETING_LIST_TOOLBAR_BLEED,
  MARKETING_PAGE_GUTTER,
  MARKETING_PAGE_GUTTER_X,
} from "../src/marketing-chrome.js";

/** Tailwind spacing step per breakpoint prefix ("" = base), e.g. "px-4 md:px-6" → { "": 4, md: 6 }. */
function stepsByBreakpoint(classes: string, utility: "px" | "-mx"): Record<string, number> {
  const steps: Record<string, number> = {};
  for (const token of classes.split(/\s+/)) {
    const match = token.match(/^(?:(\w+):)?(-?\w+)-(\d+)$/);
    if (match?.[2] === utility) steps[match[1] ?? ""] = Number(match[3]);
  }
  return steps;
}

describe("LAX page gutter", () => {
  it("is 16 / 24 / 40px at mobile / md / lg (lax.art Figma)", () => {
    expect(MARKETING_PAGE_GUTTER_X).toBe("px-4 md:px-6 lg:px-10");
    const pixels = Object.fromEntries(
      Object.entries(stepsByBreakpoint(MARKETING_PAGE_GUTTER_X, "px")).map(([bp, step]) => [
        bp,
        step * 4,
      ]),
    );
    expect(pixels).toEqual({ "": 16, md: 24, lg: 40 });
  });

  it("feeds the page and catalogue gutters", () => {
    expect(MARKETING_PAGE_GUTTER).toContain(MARKETING_PAGE_GUTTER_X);
    expect(MARKETING_CATALOG_GUTTER).toContain(MARKETING_PAGE_GUTTER_X);
  });

  it("pairs the toolbar bleed with the gutter at every breakpoint", () => {
    expect(stepsByBreakpoint(MARKETING_LIST_TOOLBAR_BLEED, "-mx")).toEqual(
      stepsByBreakpoint(MARKETING_PAGE_GUTTER_X, "px"),
    );
  });
});
