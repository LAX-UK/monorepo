import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Pages that change their own query string (filters, sort, tabs, A–Z, pagination) must not sit
 * inside a `loading.tsx` boundary. A query-only navigation re-renders the page inside the same,
 * already visible Suspense boundary; with the React build bundled in Next 15.5 the transition can
 * lose its retry and never commit in production, so the URL and results silently stay put.
 * See ArtArtworksCataloguePage for the full explanation.
 */
describe("query-navigated routes", () => {
  const appDir = fileURLToPath(new URL("../../app", import.meta.url));

  function pages(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return pages(path);
      return entry.name === "page.tsx" ? [path] : [];
    });
  }

  /** Routes whose own links rewrite the query string: tabs, A–Z, sort and filters. */
  const QUERY_NAVIGATED = ["artists/(index)", "exhibitions/(index)", "search"];

  function expectNoLoadingAbove(page: string) {
    for (let dir = dirname(page); dir.startsWith(appDir); dir = dirname(dir)) {
      expect(existsSync(join(dir, "loading.tsx")), relative(appDir, page)).toBe(false);
    }
  }

  it("keeps every artwork catalogue page outside loading boundaries", () => {
    const cataloguePages = pages(appDir).filter((page) =>
      readFileSync(page, "utf8").includes("<ArtArtworksCataloguePage"),
    );
    expect(cataloguePages.length).toBeGreaterThanOrEqual(3);
    for (const page of cataloguePages) expectNoLoadingAbove(page);
  });

  it.each(QUERY_NAVIGATED)("keeps %s outside loading boundaries", (route) => {
    const page = join(appDir, route, "page.tsx");
    expect(existsSync(page), route).toBe(true);
    expectNoLoadingAbove(page);
  });
});
