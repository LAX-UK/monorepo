import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VIEW_TRANSITION_ATTR, withViewTransition } from "./view-transition-runtime";

type Doc = { startViewTransition?: unknown };

function stubMatchMedia(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: reduced, addEventListener() {}, removeEventListener() {} }),
  );
}

describe("withViewTransition", () => {
  const root = document.documentElement;

  beforeEach(() => {
    stubMatchMedia(false);
  });

  afterEach(() => {
    (document as Doc).startViewTransition = undefined;
    delete root.dataset.reduceMotion;
    root.removeAttribute(VIEW_TRANSITION_ATTR);
    vi.unstubAllGlobals();
  });

  function installTransition() {
    let finish: () => void = () => undefined;
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const start = vi.fn((update: () => void) => {
      update();
      return { finished };
    });
    (document as Doc).startViewTransition = start;
    return { start, finish };
  }

  it("marks the root with its kind only while the transition runs", async () => {
    const { start, finish } = installTransition();
    const update = vi.fn();
    const onFinished = vi.fn();
    withViewTransition("lot", update, onFinished);
    expect(start).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
    expect(root.getAttribute(VIEW_TRANSITION_ATTR)).toBe("lot");
    finish();
    await vi.waitFor(() => expect(onFinished).toHaveBeenCalledOnce());
    expect(root.hasAttribute(VIEW_TRANSITION_ATTR)).toBe(false);
  });

  it("swaps content without a transition under prefers-reduced-motion", () => {
    stubMatchMedia(true);
    const { start } = installTransition();
    const update = vi.fn();
    withViewTransition("admin", update);
    expect(start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledOnce();
    expect(root.hasAttribute(VIEW_TRANSITION_ATTR)).toBe(false);
  });

  it("swaps content without a transition under the in-app motion switch", () => {
    root.dataset.reduceMotion = "force-reduce";
    const { start } = installTransition();
    const update = vi.fn();
    withViewTransition("theme", update);
    expect(start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledOnce();
  });

  it("lets the in-app switch re-allow motion over the OS preference", () => {
    stubMatchMedia(true);
    root.dataset.reduceMotion = "force-allow";
    const { start } = installTransition();
    withViewTransition("admin", vi.fn());
    expect(start).toHaveBeenCalledOnce();
  });

  it("updates and finishes when the browser has no support", () => {
    const update = vi.fn();
    const onFinished = vi.fn();
    withViewTransition("theme", update, onFinished);
    expect(update).toHaveBeenCalledOnce();
    expect(onFinished).toHaveBeenCalledOnce();
  });
});

describe("view transition CSS", () => {
  const css = readFileSync(
    path.resolve(__dirname, "../../../../packages/marketing-ui/src/marketing-header.css"),
    "utf8",
  );

  it("never applies the circle wipe outside the theme switch", () => {
    const wipe = css.match(/[^{}]*\{[^{}]*animation:\s*theme-reveal[^{}]*\}/)?.[0] ?? "";
    expect(wipe).toContain('[data-view-transition="theme"]');
    // Every selector that mentions the root transition pseudo-elements is scoped to a kind.
    const bareRoot = css.match(/(^|[,}\n])\s*::view-transition-(old|new)\(root\)/gm);
    expect(bareRoot).toBeNull();
  });

  it("times the morph and the admin fade from the tokens", () => {
    expect(css).toMatch(/\[data-view-transition="lot"\][\s\S]*?var\(--lax-motion-morph\)/);
    expect(css).toMatch(/\[data-view-transition="lot"\][\s\S]*?var\(--lax-ease-emphasize\)/);
    expect(css).toContain("var(--lax-motion-page-out)");
    expect(css).toContain("var(--lax-motion-page-in)");
  });

  it("keeps the transition layer from taking clicks", () => {
    expect(css).toMatch(/::view-transition,[\s\S]*?pointer-events:\s*none/);
  });
});
