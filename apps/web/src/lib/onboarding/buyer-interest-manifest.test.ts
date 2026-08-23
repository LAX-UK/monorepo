import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BUYER_INTEREST_CATEGORY_SLUGS } from "@auction/validators";
import { describe, expect, it } from "vitest";
import { BUYER_INTERESTS, recommendationCategorySlugs } from "./buyer-interest-manifest";

describe("buyer interest manifest", () => {
  it("references committed interest tile assets", () => {
    const publicDir = join(process.cwd(), "public");
    for (const interest of BUYER_INTERESTS) {
      expect(existsSync(join(publicDir, interest.image.replace(/^\//, "")))).toBe(true);
    }
  });

  it("uses actual PNG data for every .png tile", () => {
    const publicDir = join(process.cwd(), "public");
    for (const interest of BUYER_INTERESTS) {
      const bytes = readFileSync(join(publicDir, interest.image.replace(/^\//, ""))).subarray(0, 8);
      expect(bytes.toString("hex")).toBe("89504e470d0a1a0a");
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
    expect(new Set(BUYER_INTERESTS.map(({ categorySlug }) => categorySlug))).toEqual(
      new Set(BUYER_INTEREST_CATEGORY_SLUGS),
    );
  });

  it("persists Something else but excludes it from recommendation filters", () => {
    const somethingElse = BUYER_INTERESTS.find((interest) => interest.key === "something-else");
    expect(somethingElse?.categorySlug).toBe("mixed-media");
    expect(recommendationCategorySlugs(["art", "something-else"])).toEqual(["paintings"]);
  });
});
