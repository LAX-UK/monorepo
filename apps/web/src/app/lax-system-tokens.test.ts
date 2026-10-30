import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Bid's client workspace reads the shared LAX system layer for the values both kits share: the
 * status palette, shadows, focus, disabled style, radius roles and the workspace page and sidebar.
 * These checks keep Bid from drifting back to copies of its own.
 */
const SRC_DIR = path.resolve(__dirname, "..");
const read = (file: string) => readFileSync(path.join(SRC_DIR, file), "utf8");
const globals = read("app/globals.css");
const dark = read("styles/tokens-dark.css");
const lax = read("../../../packages/branding/public/lax-system.css");

/** Tokens Bid takes from the LAX system, and the token each one reads. */
const SHARED: Readonly<Record<string, string>> = {
  "--color-info-container": "--lax-info-bg",
  "--color-info-on-surface": "--lax-info-fg",
  "--color-info": "--lax-info-dot",
  "--color-warning-container": "--lax-warning-bg",
  "--color-warning-on-surface": "--lax-warning-fg",
  "--color-danger-container": "--lax-danger-bg",
  "--color-danger-on-surface": "--lax-danger-fg",
  "--color-success-container": "--lax-success-bg",
  "--color-on-success-container": "--lax-success-fg",
  "--color-ring": "--lax-focus",
  "--color-input-border": "--lax-control-edge",
  "--color-input-border-focus": "--lax-focus",
  "--color-disabled-fg": "--lax-disabled-fg",
  "--color-disabled-bg": "--lax-disabled-bg",
  "--color-disabled-border": "--lax-disabled-border",
  "--shadow-rest": "--lax-shadow-xs",
  "--shadow-hover": "--lax-shadow-md",
  "--radius-control": "--lax-radius-control",
  "--radius-card": "--lax-radius-card",
  "--radius-pill": "--lax-radius-pill",
  "--color-shell-page-bg": "--lax-page",
  "--color-shell-sidebar": "--lax-side",
};

function declarations(css: string, name: string): string[] {
  return [...css.matchAll(new RegExp(`${name}:\\s*([^;]+);`, "g"))].map((m) =>
    (m[1] as string).trim(),
  );
}

describe("Bid reads the LAX system layer", () => {
  it("imports the layer after the brand primitives", () => {
    const primitives = globals.indexOf('@import "@auction/branding/brand-primitives.css"');
    const layer = globals.indexOf('@import "@auction/branding/lax-system.css"');
    expect(primitives).toBeGreaterThanOrEqual(0);
    expect(layer).toBeGreaterThan(primitives);
  });

  it.each(Object.entries(SHARED))("%s reads %s, once", (token, shared) => {
    expect(declarations(globals, token)).toEqual([`var(${shared})`]);
  });

  it.each(Object.keys(SHARED))(
    "dark mode does not override %s (its pair carries dark)",
    (token) => {
      expect(declarations(dark, token)).toEqual([]);
    },
  );

  it("only reads LAX tokens the layer defines", () => {
    const refs = [...`${globals}\n${dark}`.matchAll(/var\((--lax-[\w-]+)\)/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThanOrEqual(Object.keys(SHARED).length);
    for (const ref of refs) expect(lax, ref).toContain(`${ref}:`);
  });
});

describe("the organisation workspace reads the LAX surfaces", () => {
  const start = globals.indexOf("[data-workspace-shell] {");
  const block = globals.slice(start, globals.indexOf("}", start));

  it("maps Bid's older surface and text tokens onto the layer, inside the shell only", () => {
    expect(start).toBeGreaterThan(0);
    for (const [token, shared] of [
      ["--color-surface-container-lowest", "--lax-surface"],
      ["--color-surface-container-low", "--lax-sunken"],
      ["--color-on-surface", "--lax-fg"],
      ["--color-on-surface-variant", "--lax-muted"],
      ["--color-shell-stroke", "--lax-line"],
    ] as const) {
      expect(declarations(block, token)).toEqual([`var(${shared})`]);
    }
  });

  it("reads only layer tokens there, so both schemes follow from one block", () => {
    for (const value of [...block.matchAll(/:\s*([^;]+);/g)].map((m) => m[1])) {
      expect(value).toMatch(/^var\(--lax-[\w-]+\)$/);
    }
  });
});
