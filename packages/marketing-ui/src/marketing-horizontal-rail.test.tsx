/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketingHorizontalRail } from "./marketing-horizontal-rail.js";

describe("MarketingHorizontalRail", () => {
  const matchMediaMock = vi.fn();
  let resizeCallback: (() => void) | undefined;

  beforeEach(() => {
    resizeCallback = undefined;
    vi.stubGlobal(
      "ResizeObserver",
      vi.fn(function ResizeObserverMock(this: ResizeObserver, cb: ResizeObserverCallback) {
        resizeCallback = () => cb([], this);
        this.observe = vi.fn();
        this.disconnect = vi.fn();
        this.unobserve = vi.fn();
      }),
    );
    matchMediaMock.mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.stubGlobal("matchMedia", matchMediaMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders configurable scroller semantics and label", () => {
    render(
      <MarketingHorizontalRail
        id="picks-rail"
        ariaLabel="Editor's picks"
        forwardAriaLabel="Scroll to see more editor's picks"
        scrollerAs="ul"
        scrollerClassName="test-row"
      >
        <li>One</li>
      </MarketingHorizontalRail>,
    );
    const region = screen.getByRole("list", { name: "Editor's picks" });
    expect(region).toHaveAttribute("id", "picks-rail");
    expect(region.tagName).toBe("UL");
    expect(region).toHaveClass("test-row");
  });

  it("shows forward affordance when overflow remains and wires aria-controls", async () => {
    render(
      <MarketingHorizontalRail
        id="overflow-rail"
        ariaLabel="Originals"
        forwardAriaLabel="Scroll to see more originals"
        scrollerAs="section"
      >
        <div>card</div>
      </MarketingHorizontalRail>,
    );
    const region = document.getElementById("overflow-rail");
    expect(region).toBeTruthy();
    Object.defineProperty(region, "clientWidth", { configurable: true, value: 200 });
    Object.defineProperty(region, "scrollWidth", { configurable: true, value: 500 });
    Object.defineProperty(region, "scrollLeft", { configurable: true, value: 0, writable: true });

    resizeCallback?.();
    region?.dispatchEvent(new Event("scroll"));

    const forward = await waitFor(() =>
      screen.getByRole("button", { name: "Scroll to see more originals" }),
    );
    expect(forward).toHaveAttribute("aria-controls", "overflow-rail");
  });

  it("scrolls forward by ~75% viewport with reduced motion", async () => {
    const scrollBy = vi.fn();
    render(
      <MarketingHorizontalRail
        id="scroll-rail"
        ariaLabel="Prints"
        forwardAriaLabel="Scroll to see more prints"
      >
        <div>card</div>
      </MarketingHorizontalRail>,
    );
    const region = document.getElementById("scroll-rail");
    expect(region).toBeTruthy();
    Object.defineProperty(region, "clientWidth", { configurable: true, value: 400 });
    Object.defineProperty(region, "scrollWidth", { configurable: true, value: 900 });
    Object.defineProperty(region, "scrollLeft", { configurable: true, value: 0, writable: true });
    if (region) region.scrollBy = scrollBy;

    resizeCallback?.();
    region?.dispatchEvent(new Event("scroll"));
    const forward = await waitFor(() =>
      screen.getByRole("button", { name: "Scroll to see more prints" }),
    );
    fireEvent.click(forward);

    expect(scrollBy).toHaveBeenCalledWith({ left: 300, behavior: "auto" });
  });
});
