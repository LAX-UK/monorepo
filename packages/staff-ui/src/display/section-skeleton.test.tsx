import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionSkeleton } from "./states.js";

describe("SectionSkeleton", () => {
  it("draws the header action and description only when the real card has them", () => {
    const bare = render(<SectionSkeleton rows={2} />).container;
    const full = render(<SectionSkeleton rows={2} description action />).container;
    const headerBlocks = (root: HTMLElement) =>
      root.firstElementChild?.firstElementChild?.querySelectorAll("*").length ?? 0;
    expect(headerBlocks(full)).toBeGreaterThan(headerBlocks(bare));
  });

  it("is hidden from screen readers, with one row per fact or table row", () => {
    const facts = render(<SectionSkeleton rows={5} />).container.firstElementChild;
    expect(facts?.getAttribute("aria-hidden")).toBe("true");
    expect(facts?.querySelectorAll(".\\@container > div")).toHaveLength(5);
    const table = render(<SectionSkeleton rows={4} body="table" />).container.firstElementChild;
    // The heading row, then the rows.
    expect(table?.querySelectorAll(".h-11")).toHaveLength(4);
    expect(table?.querySelectorAll(".h-9")).toHaveLength(1);
  });
});
