/** @vitest-environment jsdom */
import { useViewTransitionRouter } from "@/lib/hooks/use-view-transition-router";
import { withViewTransition } from "@/lib/view-transition-runtime";
import { installFakeViewTransitions, stubReducedMotionQuery } from "@/test/fake-view-transitions";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./theme-toggle";

vi.mock("@/lib/actions/user-ui-preferences", () => ({
  syncUiThemeFromClientAction: vi.fn(async () => undefined),
}));

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const TOGGLE_VARS = ["--theme-toggle-at", "--theme-toggle-radius"];

describe("ThemeToggle view transition", () => {
  const root = document.documentElement;
  let fake: ReturnType<typeof installFakeViewTransitions>;

  const kind = () => root.getAttribute("data-view-transition");
  const toggleVars = () => TOGGLE_VARS.filter((name) => root.style.getPropertyValue(name));
  const press = () => fireEvent.click(screen.getByRole("button", { name: /Switch to/ }));
  const flush = () => act(() => fake.flush());

  beforeEach(() => {
    stubReducedMotionQuery(false);
    fake = installFakeViewTransitions();
    root.classList.remove("dark");
  });

  afterEach(() => {
    fake.uninstall();
    root.removeAttribute("data-view-transition");
    root.removeAttribute("style");
    delete root.dataset.reduceMotion;
    vi.unstubAllGlobals();
  });

  it("marks the switch as a theme transition while it runs, then cleans up", async () => {
    render(<ThemeToggle />);
    press();
    expect(fake.start).toHaveBeenCalledOnce();
    await flush();
    expect(root.classList.contains("dark")).toBe(true);
    expect(kind()).toBe("theme");
    expect(toggleVars()).toEqual(TOGGLE_VARS);
    fake.transitions[0]?.finish();
    await flush();
    expect(kind()).toBeNull();
    expect(toggleVars()).toEqual([]);
  });

  it("cleans up when the update fails", async () => {
    render(<ThemeToggle />);
    press();
    await flush();
    fake.transitions[0]?.abort();
    await flush();
    expect(kind()).toBeNull();
    expect(toggleVars()).toEqual([]);
  });

  it("switches instantly under the in-app reduce switch, without starting a transition", () => {
    root.dataset.reduceMotion = "force-reduce";
    render(<ThemeToggle />);
    press();
    expect(fake.start).not.toHaveBeenCalled();
    expect(root.classList.contains("dark")).toBe(true);
    expect(kind()).toBeNull();
    expect(toggleVars()).toEqual([]);
  });

  it("switches instantly under the OS setting, unless the in-app switch allows motion", () => {
    stubReducedMotionQuery(true);
    render(<ThemeToggle />);
    press();
    expect(fake.start).not.toHaveBeenCalled();
    expect(root.classList.contains("dark")).toBe(true);
    root.dataset.reduceMotion = "force-allow";
    press();
    expect(fake.start).toHaveBeenCalledOnce();
  });

  it("keeps a newer switch's wipe when it supersedes an older one", async () => {
    render(<ThemeToggle />);
    press();
    press();
    await flush();
    expect(kind()).toBe("theme");
    expect(toggleVars()).toEqual(TOGGLE_VARS);
    fake.transitions[1]?.finish();
    await flush();
    expect(kind()).toBeNull();
    expect(toggleVars()).toEqual([]);
  });

  it("cleans up a switch that a page change supersedes, leaving the page change unmarked", async () => {
    render(<ThemeToggle />);
    press();
    await flush();
    withViewTransition(() => undefined);
    await flush();
    expect(toggleVars()).toEqual([]);
    expect(kind()).toBeNull();
  });

  it("cleans up a switch that an admin navigation supersedes, and marks the navigation", async () => {
    render(<ThemeToggle />);
    const { result } = renderHook(() => useViewTransitionRouter());
    press();
    await flush();
    result.current.push("/admin/lots");
    await flush();
    expect(router.push).toHaveBeenCalledWith("/admin/lots", undefined);
    expect(toggleVars()).toEqual([]);
    expect(kind()).toBe("admin");
    fake.transitions[1]?.finish();
    await flush();
    expect(kind()).toBeNull();
  });

  it("marks a theme switch that supersedes an admin navigation", async () => {
    render(<ThemeToggle />);
    const { result } = renderHook(() => useViewTransitionRouter());
    result.current.replace("/admin/sales");
    await flush();
    expect(kind()).toBe("admin");
    press();
    await flush();
    expect(kind()).toBe("theme");
    expect(toggleVars()).toEqual(TOGGLE_VARS);
  });

  it("leaves no admin marker when reduced motion skips the navigation's transition", () => {
    root.dataset.reduceMotion = "force-reduce";
    const { result } = renderHook(() => useViewTransitionRouter());
    result.current.push("/admin");
    expect(fake.start).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/admin", undefined);
    expect(kind()).toBeNull();
  });
});
