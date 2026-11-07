import { afterEach, describe, expect, it, vi } from "vitest";
import { focusPageHeading, focusPageHeadingWhenSettled } from "./focus-page-heading";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("focusPageHeading", () => {
  it("focuses the page's h1 without making it a tab stop", () => {
    document.body.innerHTML = "<header><h1>Site</h1></header><main><h1>Home</h1></main>";
    expect(focusPageHeading()).toBe(true);
    expect(document.activeElement?.textContent).toBe("Home");
    expect(document.activeElement).toHaveAttribute("tabindex", "-1");
  });

  it("falls back to the first h1 outside a main landmark", () => {
    document.body.innerHTML = "<div><h1>Bids</h1></div>";
    expect(focusPageHeading()).toBe(true);
    expect(document.activeElement?.textContent).toBe("Bids");
  });

  it("does nothing when there is no heading", () => {
    document.body.innerHTML = "<main><p>Hello</p></main>";
    expect(focusPageHeading()).toBe(false);
  });
});

describe("focusPageHeadingWhenSettled", () => {
  it("puts focus back on the heading if the page drops it while loading", () => {
    vi.useFakeTimers();
    document.body.innerHTML = "<main><h1>Home</h1></main>";
    focusPageHeadingWhenSettled();
    expect(document.activeElement?.textContent).toBe("Home");
    (document.activeElement as HTMLElement).blur();
    vi.advanceTimersByTime(150);
    expect(document.activeElement?.textContent).toBe("Home");
    vi.useRealTimers();
  });

  it("leaves focus alone once something else has it", () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<main><h1>Home</h1><button type="button">Go</button></main>';
    focusPageHeadingWhenSettled();
    document.querySelector("button")?.focus();
    vi.advanceTimersByTime(2000);
    expect(document.activeElement?.textContent).toBe("Go");
    vi.useRealTimers();
  });
});
