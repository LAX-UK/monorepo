/** @vitest-environment jsdom */
import {
  measureThemeRevealOrigin,
  prefersReducedMotion,
  revealShopThemeFromToggle,
} from "@/lib/theme/shop-theme-transition";
import { afterEach, describe, expect, it, vi } from "vitest";

type ViewTransitionStub = {
  startViewTransition: ((cb: () => void) => { finished: Promise<void> }) | undefined;
};

const originalMatchMedia = window.matchMedia;
const originalStartViewTransition = (document as unknown as ViewTransitionStub).startViewTransition;

function mockMatchMedia(matches: boolean | ((query: string) => boolean)): void {
  window.matchMedia = ((query: string) => ({
    matches: typeof matches === "function" ? matches(query) : matches,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

function setStartViewTransition(
  impl: ((cb: () => void) => { finished: Promise<void> }) | undefined,
): void {
  (document as unknown as ViewTransitionStub).startViewTransition = impl;
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  setStartViewTransition(originalStartViewTransition);
  document.documentElement.style.removeProperty("--theme-toggle-x");
  document.documentElement.style.removeProperty("--theme-toggle-y");
  document.documentElement.style.removeProperty("--theme-toggle-radius");
  vi.restoreAllMocks();
});

describe("shop theme transition", () => {
  it("measures the reveal origin from the toggle center", () => {
    const button = document.createElement("button");
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 20,
      width: 44,
      height: 44,
      right: 144,
      bottom: 64,
      x: 100,
      y: 20,
      toJSON: () => ({}),
    });
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1000);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);

    const origin = measureThemeRevealOrigin(button);
    expect(origin.x).toBe(122);
    expect(origin.y).toBe(42);
    expect(origin.radius).toBeCloseTo(Math.hypot(1000 - 122, 800 - 42));
  });

  it("applies immediately when reduced motion is preferred", () => {
    mockMatchMedia((query) => query.includes("prefers-reduced-motion"));

    const apply = vi.fn();
    revealShopThemeFromToggle(null, apply);
    expect(apply).toHaveBeenCalledOnce();
    expect(document.documentElement.style.getPropertyValue("--theme-toggle-x")).toBe("");
  });

  it("applies immediately when View Transitions are unavailable", () => {
    mockMatchMedia(false);
    setStartViewTransition(undefined);

    const apply = vi.fn();
    revealShopThemeFromToggle(null, apply);
    expect(apply).toHaveBeenCalledOnce();
  });

  it("starts a view transition and cleans origin properties when it finishes", async () => {
    mockMatchMedia(false);

    let resolveFinished: (() => void) | undefined;
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });
    const apply = vi.fn();
    setStartViewTransition((cb) => {
      cb();
      return { finished };
    });

    revealShopThemeFromToggle(null, apply);
    expect(apply).toHaveBeenCalledOnce();
    expect(document.documentElement.style.getPropertyValue("--theme-toggle-x")).toMatch(/px$/);

    resolveFinished?.();
    await finished;
    await Promise.resolve();
    expect(document.documentElement.style.getPropertyValue("--theme-toggle-x")).toBe("");
  });

  it("applies immediately when startViewTransition throws", () => {
    mockMatchMedia(false);
    setStartViewTransition(() => {
      throw new Error("unsupported");
    });

    const apply = vi.fn();
    revealShopThemeFromToggle(null, apply);
    expect(apply).toHaveBeenCalledOnce();
    expect(document.documentElement.style.getPropertyValue("--theme-toggle-x")).toBe("");
  });

  it("reports reduced motion from the media query", () => {
    mockMatchMedia((query) => query.includes("prefers-reduced-motion"));
    expect(prefersReducedMotion()).toBe(true);
  });
});
