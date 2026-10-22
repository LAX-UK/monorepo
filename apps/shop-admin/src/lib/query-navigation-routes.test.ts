import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Staff lists page through `?cursor=`. A query-only navigation re-renders the page inside a
 * Suspense boundary that is already on screen; with the React build bundled in Next 15.5 that
 * transition can lose its retry and never commit in production, so "Next page" would change the
 * URL while the rows stay put. A `loading.tsx` anywhere above a list creates that boundary.
 */
describe("staff list routes", () => {
  const appDir = fileURLToPath(new URL("../app", import.meta.url));

  function pages(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return pages(path);
      return entry.name === "page.tsx" ? [path] : [];
    });
  }

  const queryNavigatedPages = pages(appDir).filter((page) =>
    readFileSync(page, "utf8").includes("searchParams"),
  );

  it("finds the paged lists", () => {
    expect(queryNavigatedPages.length).toBeGreaterThanOrEqual(10);
  });

  it.each(queryNavigatedPages.map((page) => relative(appDir, page)))(
    "keeps %s outside loading boundaries",
    (route) => {
      const page = join(appDir, route);
      for (let dir = dirname(page); dir.startsWith(appDir); dir = dirname(dir)) {
        expect(existsSync(join(dir, "loading.tsx")), relative(appDir, dir) || "app").toBe(false);
      }
    },
  );
});
