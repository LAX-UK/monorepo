import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The lax.art home hero is visible at start (docs/design/motion.md, MO15 and Q3): the server HTML
 * and the first paint show the panel and its headline. The editorial entrance stays, but only
 * settles the panel into place; it never starts it hidden.
 */
const css = readFileSync(path.join(import.meta.dirname, "base.css"), "utf8");
const hero = readFileSync(
  path.join(import.meta.dirname, "../components/home/art-home-hero.tsx"),
  "utf8",
);

function keyframes(name: string): string {
  const match = new RegExp(`@keyframes ${name} \\{((?:[^{}]*\\{[^{}]*\\})*)\\s*\\}`).exec(css);
  if (!match?.[1]) throw new Error(`@keyframes ${name} is missing`);
  return match[1];
}

function declaration(name: string): string {
  const match = new RegExp(`${name}:([^;]+);`).exec(css);
  if (!match?.[1]) throw new Error(`${name} is not set`);
  return match[1];
}

describe("lax.art home hero at start", () => {
  it("the panel entrance moves it into place without ever hiding it", () => {
    const body = keyframes("art-hero-panel-in");
    expect(body).not.toMatch(/opacity|visibility|clip-path/);
    expect([...body.matchAll(/([\w-]+)\s*:/g)].map((m) => m[1])).toEqual([
      "transform",
      "transform",
    ]);
  });

  it("the panel entrance is timed from tokens, with lax.art's editorial reveal timing", () => {
    const value = declaration("--animate-art-hero-panel-in");
    expect(value).toContain("var(--motion-duration-lg)");
    expect(value).toContain("var(--motion-ease-emphasize)");
    expect(value).not.toMatch(
      /\b\d+(?:\.\d+)?m?s\b|cubic-bezier|(?<![-\w])ease(?:-out|-in)?(?![-\w])/,
    );
  });

  it("the hero drift keeps the photograph on screen: it only scales up from 1", () => {
    const body = keyframes("art-hero-drift");
    expect(body).not.toMatch(/opacity|visibility|clip-path/);
    expect(body).toContain("scale(1)");
  });

  it("the hero markup hides nothing at rest, and moves only when motion is allowed", () => {
    expect(hero).not.toMatch(/(^|[\s"])(opacity-0|invisible|hidden)(?=[\s"])/);
    for (const animation of hero.matchAll(/([\w:-]*)animate-art-hero-[\w-]+/g)) {
      expect(animation[1]).toBe("motion-safe:");
    }
  });
});
