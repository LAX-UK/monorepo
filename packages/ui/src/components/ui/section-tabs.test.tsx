import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { readScrollEdges } from "../../hooks/use-scroll-edges.js";
import { SectionTabs } from "./section-tabs.js";

const ITEMS = [
  { id: "profile", label: "Profile", href: "/organisation" },
  { id: "members", label: "Members", href: "/organisation/members" },
  { id: "documents", label: "Documents", href: "/organisation/documents" },
  { id: "payouts", label: "Payouts", href: "/organisation/payouts" },
  { id: "security", label: "Security", href: "/organisation/security" },
];

/** jsdom has no layout: give the scroller the sizes a 375px phone would. */
function sizeScroller(el: HTMLElement, { scrollWidth, clientWidth, scrollLeft = 0 }: Sizes) {
  Object.defineProperty(el, "scrollWidth", { configurable: true, value: scrollWidth });
  Object.defineProperty(el, "clientWidth", { configurable: true, value: clientWidth });
  el.scrollLeft = scrollLeft;
}
type Sizes = { scrollWidth: number; clientWidth: number; scrollLeft?: number };

function renderTabs(active = "profile") {
  render(<SectionTabs ariaLabel="Organisation" casing="sentence" active={active} items={ITEMS} />);
  const nav = screen.getByRole("navigation", { name: "Organisation" });
  return { nav, scroller: nav.parentElement as HTMLElement };
}

describe("SectionTabs, underline", () => {
  it("keeps every tab on one line and scrolls sideways instead of wrapping", () => {
    const { nav, scroller } = renderTabs();
    expect(nav.className).toContain("flex-nowrap");
    expect(nav.className).not.toContain("flex-wrap ");
    expect(nav.className).toContain("w-max");
    expect(scroller).toHaveAttribute("data-tabs-scroller");
    expect(scroller.className).toContain("overflow-x-auto");
    // Room around the tabs so a focus ring is not clipped by the scroller.
    expect(scroller.className).toContain("pt-1");
    expect(scroller.className).toContain("pb-1");
  });

  it("fades the end that hides more tabs, and both ends once scrolled", () => {
    const { scroller } = renderTabs();
    expect(scroller.className).not.toContain("mask-image");

    sizeScroller(scroller, { scrollWidth: 420, clientWidth: 343 });
    act(() => {
      fireEvent.scroll(scroller);
    });
    expect(scroller.className).toContain(
      "[mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]",
    );

    sizeScroller(scroller, { scrollWidth: 420, clientWidth: 343, scrollLeft: 40 });
    act(() => {
      fireEvent.scroll(scroller);
    });
    expect(scroller.className).toContain(
      "[mask-image:linear-gradient(to_right,transparent,black_1.5rem,black_calc(100%-1.5rem),transparent)]",
    );

    sizeScroller(scroller, { scrollWidth: 420, clientWidth: 343, scrollLeft: 77 });
    act(() => {
      fireEvent.scroll(scroller);
    });
    expect(scroller.className).toContain(
      "[mask-image:linear-gradient(to_right,transparent,black_1.5rem)]",
    );
  });

  it("marks the current tab", () => {
    renderTabs("security");
    expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute("aria-current", "page");
  });
});

describe("readScrollEdges", () => {
  it.each([
    [
      { scrollWidth: 300, clientWidth: 300, scrollLeft: 0 },
      { start: false, end: false },
    ],
    [
      { scrollWidth: 301, clientWidth: 300, scrollLeft: 0 },
      { start: false, end: false },
    ],
    [
      { scrollWidth: 420, clientWidth: 343, scrollLeft: 0 },
      { start: false, end: true },
    ],
    [
      { scrollWidth: 420, clientWidth: 343, scrollLeft: 30 },
      { start: true, end: true },
    ],
    [
      { scrollWidth: 420, clientWidth: 343, scrollLeft: 77 },
      { start: true, end: false },
    ],
  ])("%o hides %o", (sizes, edges) => {
    expect(readScrollEdges(sizes)).toEqual(edges);
  });
});
