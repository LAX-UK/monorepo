import { buildLinkedInShareUrl, buildTwitterShareUrl } from "@/lib/marketing/share-urls";
import { describe, expect, it } from "vitest";

describe("share-urls", () => {
  it("builds X share intent URLs", () => {
    expect(buildTwitterShareUrl("https://example.com/article", "Headline")).toBe(
      "https://twitter.com/intent/tweet?url=https%3A%2F%2Fexample.com%2Farticle&text=Headline",
    );
  });

  it("builds LinkedIn share URLs", () => {
    expect(buildLinkedInShareUrl("https://example.com/article")).toBe(
      "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fexample.com%2Farticle",
    );
  });
});
