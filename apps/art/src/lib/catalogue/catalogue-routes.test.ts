import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("artwork catalogue routes", () => {
  const appDir = fileURLToPath(new URL("../../app", import.meta.url));

  function pages(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return pages(path);
      return entry.name === "page.tsx" ? [path] : [];
    });
  }

  // See ArtArtworksCataloguePage: a loading boundary around a page that navigates by query
  // string leaves filter, sort and pagination navigations stuck in production builds.
  it("render outside every loading.tsx boundary so query navigations commit", () => {
    const cataloguePages = pages(appDir).filter((page) =>
      readFileSync(page, "utf8").includes("<ArtArtworksCataloguePage"),
    );
    expect(cataloguePages.length).toBeGreaterThanOrEqual(4);
    for (const page of cataloguePages) {
      for (let dir = dirname(page); dir.startsWith(appDir); dir = dirname(dir)) {
        expect(existsSync(join(dir, "loading.tsx")), relative(appDir, page)).toBe(false);
      }
    }
  });
});
