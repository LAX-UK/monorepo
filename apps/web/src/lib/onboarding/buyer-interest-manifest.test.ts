import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BUYER_INTERESTS, recommendationCategorySlugs } from "./buyer-interest-manifest";

describe("buyer interest manifest", () => {
  it("references committed interest tile assets", () => {
    const publicDir = join(process.cwd(), "public");
    for (const interest of BUYER_INTERESTS) {
      expect(existsSync(join(publicDir, interest.image.replace(/^\//, "")))).toBe(true);
    }
  });

  it("keeps the curated labels and stable category slugs", () => {
    expect(BUYER_INTERESTS.map(({ label }) => label)).toEqual([
      "Art",
      "Watches",
      "Jewellery",
      "Coins & Medals",
      "Sculpture",
      "Antiques",
      "Memorabilia",
      "Something else",
    ]);
    expect(BUYER_INTERESTS.every(({ categorySlug }) => categorySlug.length > 0)).toBe(true);
  });

  it("persists Something else but excludes it from recommendation filters", () => {
    const somethingElse = BUYER_INTERESTS.find((interest) => interest.key === "something-else");
    expect(somethingElse?.categorySlug).toBe("mixed-media");
    expect(recommendationCategorySlugs(["art", "something-else"])).toEqual(["paintings"]);
  });
});
