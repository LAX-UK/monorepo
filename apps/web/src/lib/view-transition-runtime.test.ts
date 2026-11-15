import { readFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withViewTransition } from "./view-transition-runtime";

const VIEW_TRANSITION_ATTR = "data-view-transition";

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

  it("keeps the marker of a newer transition when an older one of the same kind ends late", async () => {
    const finishers: Array<() => void> = [];
    (document as Doc).startViewTransition = vi.fn((update: () => void) => {
      update();
      return { finished: new Promise<void>((resolve) => finishers.push(resolve)) };
    });
    const firstDone = vi.fn();
    const secondDone = vi.fn();
    withViewTransition("theme", vi.fn(), firstDone);
    withViewTransition("theme", vi.fn(), secondDone);
    finishers[0]?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(root.getAttribute(VIEW_TRANSITION_ATTR)).toBe("theme");
    expect(firstDone).not.toHaveBeenCalled();
    finishers[1]?.();
    await vi.waitFor(() => expect(secondDone).toHaveBeenCalledOnce());
    expect(root.hasAttribute(VIEW_TRANSITION_ATTR)).toBe(false);
  });

  it("styles a second transition of the same kind started after the first ended", async () => {
    const { start, finish } = installTransition();
    withViewTransition("lot", vi.fn());
    finish();
    await vi.waitFor(() => expect(root.hasAttribute(VIEW_TRANSITION_ATTR)).toBe(false));
    installTransition();
    withViewTransition("lot", vi.fn());
    expect(start).toHaveBeenCalledOnce();
    expect(root.getAttribute(VIEW_TRANSITION_ATTR)).toBe("lot");
  });

  it("finishes when the transition is aborted", async () => {
    (document as Doc).startViewTransition = vi.fn((update: () => void) => {
      update();
      return { finished: Promise.reject(new Error("aborted")) };
    });
    const onFinished = vi.fn();
    withViewTransition("admin", vi.fn(), onFinished);
    await vi.waitFor(() => expect(onFinished).toHaveBeenCalledOnce());
    expect(root.hasAttribute(VIEW_TRANSITION_ATTR)).toBe(false);
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
  const rules: postcss.Rule[] = [];
  postcss.parse(css).walkRules((rule) => {
    rules.push(rule);
  });
  const decl = (rule: postcss.Rule, prop: string) => {
    let value: string | undefined;
    rule.walkDecls(prop, (d) => {
      value = d.value;
    });
    return value;
  };
  const selectors = (rule: postcss.Rule) => rule.selectors.map((s) => s.trim());

  it("scopes every selector of the circle wipe rule to the theme kind", () => {
    const wipe = rules.filter((r) => decl(r, "animation")?.startsWith("theme-reveal"));
    expect(wipe.length).toBeGreaterThan(0);
    for (const rule of wipe) {
      for (const selector of selectors(rule)) {
        expect(selector).toContain('[data-view-transition="theme"]');
      }
    }
  });

  it("never styles the root transition outside a kind, except to cancel it for reduced motion", () => {
    for (const rule of rules) {
      for (const selector of selectors(rule)) {
        if (!/::view-transition-(old|new)\(root\)/.test(selector)) continue;
        expect(selector).toContain("[data-view-transition=");
      }
    }
  });

  it("times the morph and the admin fade from the tokens", () => {
    const lot = rules.filter((r) => selectors(r).some((s) => s.includes('="lot"]')));
    expect(lot.map((r) => decl(r, "animation-duration"))).toContain("var(--lax-motion-morph)");
    expect(lot.map((r) => decl(r, "animation-timing-function"))).toContain(
      "var(--lax-ease-emphasize)",
    );
    expect(css).toContain("var(--lax-motion-page-out)");
    expect(css).toContain("var(--lax-motion-page-in)");
  });

  it("keeps the transition layer from taking clicks", () => {
    const layer = rules.find((r) => selectors(r).includes("::view-transition"));
    expect(layer && decl(layer, "pointer-events")).toBe("none");
  });

  it("cancels the theme wipe under reduced motion with a selector that outranks it", () => {
    const reduce = rules.filter(
      (r) =>
        decl(r, "animation") === "none" &&
        selectors(r).some((s) => s.includes("[data-view-transition]::view-transition-new(*)")),
    );
    // One in the media query, one for the in-app switch; both qualified by the attribute.
    expect(reduce.length).toBeGreaterThanOrEqual(2);
  });
});
