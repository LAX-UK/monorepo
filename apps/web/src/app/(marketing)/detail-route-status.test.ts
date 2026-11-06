import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const APP = join(__dirname, "..");

/**
 * The status line goes out with the first byte, so a missing lot, sale or artist can only answer
 * 404 if the check runs before any loading shell streams. A `loading.tsx` wraps everything below
 * its segment, so none may sit above a detail route's existence check; the route's own shell
 * lives beside the check, under it.
 */
const DETAIL_ROUTES = [
  "(marketing)/lot/[slug]/[id]",
  "(marketing)/sales/[slug]/[id]",
  "(marketing)/artist/[slug]/[id]",
] as const;

function ancestorLoadingShells(route: string): string[] {
  const found: string[] = [];
  for (let dir = join(APP, dirname(route)); dir.startsWith(APP); dir = dirname(dir)) {
    if (existsSync(join(dir, "loading.tsx"))) found.push(relative(APP, dir) || ".");
    if (dir === APP) break;
  }
  return found;
}

describe.each(DETAIL_ROUTES)("%s", (route) => {
  it("checks that the page exists in its layout", () => {
    expect(existsSync(join(APP, route, "layout.tsx"))).toBe(true);
  });

  it("keeps its own loading shell under the check", () => {
    expect(existsSync(join(APP, route, "loading.tsx"))).toBe(true);
  });

  it("has no loading shell above the check", () => {
    expect(ancestorLoadingShells(route)).toEqual([]);
  });
});
