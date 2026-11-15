/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revealThemeFromToggle } from "./theme-view-transition";

type Transition = { finished: Promise<void>; finish: () => void; abort: () => void };

const root = document.documentElement;
const VARS = ["--theme-toggle-at", "--theme-toggle-radius"];
const vars = () => VARS.filter((name) => root.style.getPropertyValue(name));
const kind = () => root.getAttribute("data-view-transition");
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function stubReducedMotion(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: query.includes("reduced-motion") ? reduced : false })),
  );
}

/** `startViewTransition` with the browser's ordering: the update runs in a later task. */
function installViewTransitions() {
  const transitions: Transition[] = [];
  const start = vi.fn((update: () => void) => {
    let finish: () => void = () => undefined;
    let abort: () => void = () => undefined;
    const finished = new Promise<void>((resolve, reject) => {
      finish = resolve;
      abort = () => reject(new Error("update failed"));
    });
    setTimeout(update, 0);
    transitions.push({ finished, finish, abort });
    return { finished };
  });
  (document as { startViewTransition?: unknown }).startViewTransition = start;
  return { start, transitions };
}

function toggleButton() {
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
  return button;
}

describe("revealThemeFromToggle", () => {
  beforeEach(() => {
    stubReducedMotion(false);
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1000);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
  });

  afterEach(() => {
    (document as { startViewTransition?: unknown }).startViewTransition = undefined;
    root.removeAttribute("data-view-transition");
    root.removeAttribute("style");
    delete root.dataset.reduceMotion;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("marks a theme transition grown from the button's centre, then cleans up", async () => {
    const { transitions } = installViewTransitions();
    const apply = vi.fn(() => {
      expect(kind()).toBe("theme");
    });

    revealThemeFromToggle(toggleButton(), apply);
    // Marked inside the update, never before it.
    expect(kind()).toBeNull();
    await flush();
    expect(apply).toHaveBeenCalledOnce();
    expect(root.style.getPropertyValue("--theme-toggle-at")).toBe("122px 42px");
    expect(Number.parseFloat(root.style.getPropertyValue("--theme-toggle-radius"))).toBeCloseTo(
      Math.hypot(1000 - 122, 800 - 42),
    );

    transitions[0]?.finish();
    await flush();
    expect(kind()).toBeNull();
    expect(vars()).toEqual([]);
  });

  it("grows from the top-right corner area without a button", async () => {
    installViewTransitions();
    revealThemeFromToggle(null, vi.fn());
    await flush();
    expect(root.style.getPropertyValue("--theme-toggle-at")).toBe("968px 32px");
  });

  it("cleans up when the update fails", async () => {
    const { transitions } = installViewTransitions();
    revealThemeFromToggle(toggleButton(), vi.fn());
    await flush();
    transitions[0]?.abort();
    await flush();
    expect(kind()).toBeNull();
    expect(vars()).toEqual([]);
  });

  it("switches at once without View Transitions", () => {
    const apply = vi.fn();
    revealThemeFromToggle(toggleButton(), apply);
    expect(apply).toHaveBeenCalledOnce();
    expect(kind()).toBeNull();
    expect(vars()).toEqual([]);
  });

  it("switches at once under OS reduced motion", () => {
    stubReducedMotion(true);
    const { start } = installViewTransitions();
    const apply = vi.fn();
    revealThemeFromToggle(toggleButton(), apply);
    expect(start).not.toHaveBeenCalled();
    expect(apply).toHaveBeenCalledOnce();
  });

  it("switches at once when the in-app switch reduces motion", () => {
    root.dataset.reduceMotion = "force-reduce";
    const { start } = installViewTransitions();
    const apply = vi.fn();
    revealThemeFromToggle(toggleButton(), apply);
    expect(start).not.toHaveBeenCalled();
    expect(apply).toHaveBeenCalledOnce();
  });

  it("keeps the wipe when the in-app switch allows motion under OS reduced motion", () => {
    stubReducedMotion(true);
    root.dataset.reduceMotion = "force-allow";
    const { start } = installViewTransitions();
    revealThemeFromToggle(toggleButton(), vi.fn());
    expect(start).toHaveBeenCalledOnce();
  });
});
