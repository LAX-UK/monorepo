import { existsSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ArtContentUnavailableError, notFoundOrUnavailable } from "./page-status";

describe("notFoundOrUnavailable", () => {
  it.each(["not_found", "disabled"] as const)("answers 404 when content is %s", (state) => {
    expect(() => notFoundOrUnavailable(state, "Artwork")).toThrow(
      expect.objectContaining({ digest: expect.stringMatching(/;404$/) }),
    );
  });

  it.each(["unavailable", "error"] as const)("answers 5xx when the upstream is %s", (state) => {
    expect(() => notFoundOrUnavailable(state, "Artwork")).toThrow(ArtContentUnavailableError);
  });
});

describe("slug routes", () => {
  const appDir = fileURLToPath(new URL("../../app", import.meta.url));

  function pages(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return pages(path);
      return entry.name === "page.tsx" ? [path] : [];
    });
  }

  it("render outside every loading.tsx boundary so missing records answer 404", () => {
    const slugPages = pages(appDir).filter((page) => relative(appDir, page).includes("["));
    expect(slugPages.length).toBeGreaterThan(5);
    for (const page of slugPages) {
      for (let dir = dirname(page); dir.startsWith(appDir); dir = dirname(dir)) {
        expect(existsSync(join(dir, "loading.tsx")), relative(appDir, page)).toBe(false);
      }
    }
  });
});
