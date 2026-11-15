/** @vitest-environment jsdom */
import { withViewTransition } from "@/lib/view-transition-runtime";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./theme-toggle";

vi.mock("@/lib/actions/user-ui-preferences", () => ({
  syncUiThemeFromClientAction: vi.fn(async () => undefined),
}));

const VIEW_TRANSITION_ATTR = "data-view-transition";
const TOGGLE_VARS = ["--theme-toggle-x", "--theme-toggle-y", "--theme-toggle-radius"];

type Doc = { startViewTransition?: unknown };

function stubMatchMedia(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("reduced-motion") ? reduced : false,
      addEventListener() {},
      removeEventListener() {},
    })),
  );
}

/** Each started transition runs its update at once and finishes when its finisher is called. */
function installTransitions() {
  const finishers: Array<() => void> = [];
  const start = vi.fn((update: () => void) => {
    update();
    return { finished: new Promise<void>((resolve) => finishers.push(resolve)) };
  });
  (document as Doc).startViewTransition = start;
  return { start, finishers };
}

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));
const toggleVars = () =>
  TOGGLE_VARS.map((name) => document.documentElement.style.getPropertyValue(name)).filter(Boolean);

describe("ThemeToggle view transition", () => {
  const root = document.documentElement;

  beforeEach(() => {
    stubMatchMedia(false);
    root.classList.remove("dark");
  });

  afterEach(() => {
    (document as Doc).startViewTransition = undefined;
    root.removeAttribute(VIEW_TRANSITION_ATTR);
    root.removeAttribute("style");
    delete root.dataset.reduceMotion;
    vi.unstubAllGlobals();
  });

  const press = () => fireEvent.click(screen.getByRole("button", { name: /Switch to/ }));

  it("plays the wipe as a theme transition and cleans up when it ends", async () => {
    const { start, finishers } = installTransitions();
    render(<ThemeToggle />);
    press();
    expect(start).toHaveBeenCalledOnce();
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.getAttribute(VIEW_TRANSITION_ATTR)).toBe("theme");
    expect(toggleVars()).toHaveLength(3);
    finishers[0]?.();
    await flush();
    expect(root.hasAttribute(VIEW_TRANSITION_ATTR)).toBe(false);
    expect(toggleVars()).toEqual([]);
  });

  it("switches instantly under the in-app reduce switch, without starting a transition", () => {
    root.dataset.reduceMotion = "force-reduce";
    const { start } = installTransitions();
    render(<ThemeToggle />);
    press();
    expect(start).not.toHaveBeenCalled();
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.hasAttribute(VIEW_TRANSITION_ATTR)).toBe(false);
    expect(toggleVars()).toEqual([]);
  });

  it("switches instantly under the OS setting, unless the in-app switch allows motion", () => {
    stubMatchMedia(true);
    const { start } = installTransitions();
    render(<ThemeToggle />);
    press();
    expect(start).not.toHaveBeenCalled();
    root.dataset.reduceMotion = "force-allow";
    press();
    expect(start).toHaveBeenCalledOnce();
    expect(root.getAttribute(VIEW_TRANSITION_ATTR)).toBe("theme");
  });

  it("keeps a newer switch's wipe when an older switch ends late", async () => {
    const { finishers } = installTransitions();
    render(<ThemeToggle />);
    press();
    press();
    finishers[0]?.();
    await flush();
    expect(root.getAttribute(VIEW_TRANSITION_ATTR)).toBe("theme");
    expect(toggleVars()).toHaveLength(3);
    finishers[1]?.();
    await flush();
    expect(root.hasAttribute(VIEW_TRANSITION_ATTR)).toBe(false);
    expect(toggleVars()).toEqual([]);
  });

  it("still cleans up when a page change replaces the wipe, and keeps the page change's marker", async () => {
    const { finishers } = installTransitions();
    render(<ThemeToggle />);
    press();
    withViewTransition("lot", () => undefined);
    finishers[0]?.();
    await flush();
    expect(toggleVars()).toEqual([]);
    expect(root.getAttribute(VIEW_TRANSITION_ATTR)).toBe("lot");
    finishers[1]?.();
    await flush();
    expect(root.hasAttribute(VIEW_TRANSITION_ATTR)).toBe(false);
  });
});
