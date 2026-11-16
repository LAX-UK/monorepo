import { readFileSync } from "node:fs";
import path from "node:path";
import { installFakeViewTransitions, stubReducedMotionQuery } from "@/test/fake-view-transitions";
import postcss from "postcss";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withViewTransition } from "./view-transition-runtime";

describe("withViewTransition", () => {
  const root = document.documentElement;
  let fake: ReturnType<typeof installFakeViewTransitions>;

  beforeEach(() => {
    stubReducedMotionQuery(false);
    fake = installFakeViewTransitions();
  });

  afterEach(() => {
    fake.uninstall();
    delete root.dataset.reduceMotion;
    vi.unstubAllGlobals();
  });

  it("runs the update inside an unmarked transition and returns it", async () => {
    const update = vi.fn();
    const transition = withViewTransition(update);
    expect(fake.start).toHaveBeenCalledOnce();
    expect(transition).toBeDefined();
    await fake.flush();
    expect(update).toHaveBeenCalledOnce();
    expect(root.hasAttribute("data-view-transition")).toBe(false);
  });

  it("swaps content without a transition under prefers-reduced-motion", () => {
    stubReducedMotionQuery(true);
    const update = vi.fn();
    expect(withViewTransition(update)).toBeUndefined();
    expect(fake.start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledOnce();
  });

  it("skips the transition under the in-app reduce switch, whatever the OS says", () => {
    root.dataset.reduceMotion = "force-reduce";
    const update = vi.fn();
    expect(withViewTransition(update)).toBeUndefined();
    expect(fake.start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledOnce();
  });

  it("keeps the transition under the in-app allow switch, as useReducedMotion does", () => {
    stubReducedMotionQuery(true);
    root.dataset.reduceMotion = "force-allow";
    expect(withViewTransition(vi.fn())).toBeDefined();
    expect(fake.start).toHaveBeenCalledOnce();
  });

  it("updates plainly when the browser has no support", () => {
    fake.uninstall();
    const update = vi.fn();
    expect(withViewTransition(update)).toBeUndefined();
    expect(update).toHaveBeenCalledOnce();
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

  it("times the unmarked page change (the morph) and the admin fade from the tokens", () => {
    const lot = rules.filter((r) =>
      selectors(r).some((s) => s.startsWith(":root:not([data-view-transition])::")),
    );
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
});
