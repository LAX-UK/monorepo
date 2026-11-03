import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollRow, scrollLeftToReveal, scrollRowFade } from "./scroll-row.js";

describe("scrollRowFade", () => {
  it("draws no fade while everything fits", () => {
    expect(scrollRowFade({ start: false, end: false })).toBeUndefined();
  });

  it("fades only the edge that hides more", () => {
    expect(scrollRowFade({ start: false, end: true })).toContain("black_calc(100%-2rem)");
    expect(scrollRowFade({ start: true, end: false })).toContain("transparent,black_2rem)");
    expect(scrollRowFade({ start: true, end: true })).toContain("black_2rem,black_calc");
  });
});

describe("scrollLeftToReveal", () => {
  const row = { left: 0, right: 375, scrollLeft: 100 };

  it("leaves an item that is clear of both fades where it is", () => {
    expect(scrollLeftToReveal(row, { left: 100, right: 180 })).toBeNull();
  });

  it("scrolls forward for an item cut by the end", () => {
    expect(scrollLeftToReveal(row, { left: 300, right: 420 })).toBe(100 + 420 - 375 + 24);
  });

  it("scrolls back for an item cut by the start", () => {
    expect(scrollLeftToReveal(row, { left: -30, right: 40 })).toBe(100 - 30 - 24);
  });
});

describe("ScrollRow", () => {
  it("is a scroller with no scrollbar and renders as the element asked for", () => {
    const { container } = render(
      <ScrollRow as="nav" aria-label="Pages">
        <a href="/a" aria-current="page">
          A
        </a>
      </ScrollRow>,
    );
    const row = container.querySelector("nav");
    expect(row).toHaveAttribute("data-scroll-row");
    expect(row).toHaveAttribute("aria-label", "Pages");
    expect(row).toHaveClass("overflow-x-auto", "scroll-px-8");
  });
});
