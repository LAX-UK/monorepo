import { describe, expect, it } from "vitest";
import {
  META_DESCRIPTION_MAX_LENGTH,
  seoMetadataDescription,
  seoMetadataTitle,
  truncateMetaDescription,
} from "./seo-metadata";

describe("seo metadata", () => {
  it("uses a trimmed override title verbatim, else brands the fallback", () => {
    expect(seoMetadataTitle({ seoTitle: "  Banksy Prints | lax.art " }, "Banksy")).toBe(
      "Banksy Prints | lax.art",
    );
    expect(seoMetadataTitle({ seoTitle: "   " }, "Banksy")).toBe("Banksy | lax.art");
    expect(seoMetadataTitle({}, "Banksy")).toBe("Banksy | lax.art");
  });

  it("prefers the override description and collapses whitespace in the fallback", () => {
    expect(seoMetadataDescription({ seoDescription: "Imported." }, "Fallback")).toBe("Imported.");
    expect(seoMetadataDescription({ seoDescription: null }, "  Two\n\nlines ")).toBe("Two lines");
    expect(seoMetadataDescription({}, null)).toBeUndefined();
  });

  it("truncates long descriptions on a word boundary", () => {
    const long = `${"word ".repeat(60)}end`;
    const result = truncateMetaDescription(long);
    expect(result.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX_LENGTH);
    expect(result.endsWith("word…")).toBe(true);
    expect(truncateMetaDescription("Short.")).toBe("Short.");
  });
});
