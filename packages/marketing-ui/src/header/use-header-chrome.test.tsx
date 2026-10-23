import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HEADER_SCROLL_FADE_THRESHOLD_PX,
  type HeaderChrome,
  type UseHeaderChromeOptions,
  headerChromeClassName,
  useHeaderChrome,
} from "./use-header-chrome.js";

let resizeCallbacks: Array<() => void> = [];

class FakeResizeObserver {
  constructor(callback: () => void) {
    resizeCallbacks.push(callback);
  }
  observe() {}
  disconnect() {}
}

let latest: HeaderChrome;

function Probe(props: UseHeaderChromeOptions) {
  latest = useHeaderChrome(props);
  return <header ref={latest.attachHeader} data-testid="probe" />;
}

function scrollTo(y: number) {
  act(() => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
    window.dispatchEvent(new Event("scroll"));
  });
}

describe("useHeaderChrome", () => {
  beforeEach(() => {
    resizeCallbacks = [];
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    document.documentElement.style.removeProperty("--header-height");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("is transparent with the on-dark tone at the top of a transparent route", () => {
    render(<Probe transparent overlayOpen={false} />);
    expect(latest).toMatchObject({ isTransparent: true, atTop: true, headerTone: "on-dark" });
  });

  it("turns solid once scrolled past the threshold and transparent again at the top", () => {
    render(<Probe transparent overlayOpen={false} />);

    scrollTo(HEADER_SCROLL_FADE_THRESHOLD_PX);
    expect(latest.isTransparent).toBe(true);

    scrollTo(HEADER_SCROLL_FADE_THRESHOLD_PX + 1);
    expect(latest).toMatchObject({ isTransparent: false, atTop: false, headerTone: "on-light" });

    scrollTo(0);
    expect(latest.isTransparent).toBe(true);
  });

  it("stays solid while an overlay is open, even at the top", () => {
    const { rerender } = render(<Probe transparent overlayOpen={false} />);
    rerender(<Probe transparent overlayOpen />);
    expect(latest).toMatchObject({ isTransparent: false, atTop: true, headerTone: "on-light" });

    rerender(<Probe transparent overlayOpen={false} />);
    expect(latest.isTransparent).toBe(true);
  });

  it("never turns transparent on a non-transparent route and ignores scrolling", () => {
    render(<Probe transparent={false} overlayOpen={false} />);
    expect(latest).toMatchObject({ isTransparent: false, atTop: true, headerTone: "on-light" });

    scrollTo(500);
    expect(latest.atTop).toBe(true);
  });

  it("resets atTop when a route stops being transparent while scrolled", () => {
    const { rerender } = render(<Probe transparent overlayOpen={false} />);
    scrollTo(300);
    expect(latest.atTop).toBe(false);

    rerender(<Probe transparent={false} overlayOpen={false} />);
    expect(latest.atTop).toBe(true);
  });

  it("removes its scroll listener on unmount", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<Probe transparent overlayOpen={false} />);
    unmount();
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  });

  it("publishes --header-height and reports changes only when the height changes", () => {
    const onHeightChange = vi.fn();
    let height = 120;
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(() => height);

    render(<Probe transparent={false} overlayOpen={false} onHeightChange={onHeightChange} />);
    expect(document.documentElement.style.getPropertyValue("--header-height")).toBe("120px");
    expect(onHeightChange).toHaveBeenCalledTimes(1);

    act(() => {
      for (const callback of resizeCallbacks) callback();
    });
    expect(onHeightChange).toHaveBeenCalledTimes(1);

    height = 96;
    act(() => {
      for (const callback of resizeCallbacks) callback();
    });
    expect(document.documentElement.style.getPropertyValue("--header-height")).toBe("96px");
    expect(onHeightChange).toHaveBeenLastCalledWith(96);
  });
});

describe("headerChromeClassName", () => {
  it("is borderless and background-free while transparent", () => {
    const className = headerChromeClassName(true, false);
    expect(className).toContain("border-transparent bg-transparent");
    expect(className).not.toContain("bg-surface");
  });

  it("is the bordered surface once solid", () => {
    const className = headerChromeClassName(false, false);
    expect(className).toContain("border-nav-border bg-surface shadow-sm");
    expect(className).not.toContain("shadow-none");
  });

  it("drops the border and shadow under an open mega menu so it joins the shelf", () => {
    expect(headerChromeClassName(false, true)).toContain("border-transparent shadow-none");
  });

  it("opts out of the transition under reduced motion", () => {
    expect(headerChromeClassName(true, false)).toContain("motion-reduce:transition-none");
    expect(headerChromeClassName(false, false)).toContain("motion-reduce:transition-none");
  });
});
