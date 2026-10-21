import { describe, expect, it } from "vitest";
import type { EditorialBlock } from "./editorial-blocks.js";
import { estimateEditorialReadMinutes } from "./editorial-read-time.js";

function words(count: number): string {
  return Array.from({ length: count }, () => "word").join(" ");
}

describe("estimateEditorialReadMinutes", () => {
  it("is null for a body with no prose", () => {
    expect(estimateEditorialReadMinutes([])).toBeNull();
    expect(
      estimateEditorialReadMinutes([
        { type: "image", mediaKey: "a.webp", caption: words(50) },
        { type: "artworkRail", artworkSlugs: ["a"] },
      ]),
    ).toBeNull();
  });

  it("rounds a short piece up to one minute", () => {
    expect(estimateEditorialReadMinutes([{ type: "heading", level: 2, text: "Hello" }])).toBe(1);
  });

  it("reads at 230 words per minute across prose blocks", () => {
    const blocks: EditorialBlock[] = [
      {
        type: "richText",
        spans: [{ text: `${words(200)} ` }, { text: words(30), marks: ["bold"] }],
      },
      { type: "quote", text: words(230) },
    ];
    expect(estimateEditorialReadMinutes(blocks)).toBe(2);
    expect(estimateEditorialReadMinutes([...blocks, { type: "quote", text: "one" }])).toBe(3);
  });

  it("counts FAQ, card grid and call-to-action copy", () => {
    const blocks: EditorialBlock[] = [
      {
        type: "faqGroup",
        items: [{ question: words(100), answer: [{ text: words(100) }] }],
      },
      { type: "cardGrid", items: [{ title: words(10), body: words(20) }] },
      { type: "cta", title: "Talk", body: words(1), buttonLabel: "Go", href: "/contact" },
    ];
    // 100 + 100 + 10 + 20 + 1 + 1 = 232 words.
    expect(estimateEditorialReadMinutes(blocks)).toBe(2);
  });
});
