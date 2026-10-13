import type { EditorialBlock } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  type LegacyBlockRewriter,
  emptyBlockStats,
  firstParagraph,
  fitEditorialBlockLimit,
  rewriteLegacyBlocks,
} from "./legacy-thelax-blocks.js";

const rewriter: LegacyBlockRewriter = {
  resolveLegacyPath: (path) =>
    ({ "/collection/flower.html": "/artworks/flower", "/": "/" })[path] ?? null,
  importImage: async (url) => (url.endsWith("ok.jpg") ? "shop/editorial-inline/ok.jpg" : null),
};

describe("rewriteLegacyBlocks", () => {
  it("follows the redirect map, keeps safe external links and drops dead or insecure ones", async () => {
    const stats = emptyBlockStats();
    const blocks = await rewriteLegacyBlocks(
      [
        {
          type: "richText",
          spans: [
            { text: "a", href: "https://www.thelax.art/collection/flower.html" },
            { text: "b", href: "https://thelax.art/unknown.html" },
            { text: "c", href: "https://example.com/x" },
            { text: "d", href: "http://example.com/x" },
            { text: "e", href: "mailto:hello@thelax.art" },
          ],
        },
      ],
      rewriter,
      stats,
    );
    expect(blocks).toEqual([
      {
        type: "richText",
        spans: [
          { text: "a", href: "/artworks/flower" },
          { text: "b" },
          { text: "c", href: "https://example.com/x" },
          { text: "d" },
          { text: "e", href: "mailto:hello@thelax.art" },
        ],
      },
    ]);
    expect(stats.droppedLinks).toBe(2);
  });

  it("imports images, drops unimportable images and invalid blocks", async () => {
    const stats = emptyBlockStats();
    const blocks = await rewriteLegacyBlocks(
      [
        { type: "image", mediaKey: "https://www.thelax.art/uds/ok.jpg", alt: "Ok" },
        { type: "image", mediaKey: "https://www.thelax.art/uds/gone.jpg" },
        { type: "heading", level: 2, text: "" },
        { type: "unknown" },
      ],
      rewriter,
      stats,
    );
    expect(blocks).toEqual([
      { type: "image", mediaKey: "shop/editorial-inline/ok.jpg", alt: "Ok" },
    ]);
    expect(stats.droppedBlocks).toBe(3);
  });
});

describe("fitEditorialBlockLimit", () => {
  it("merges the shortest adjacent paragraphs until the list fits", () => {
    const stats = emptyBlockStats();
    const paragraph = (text: string): EditorialBlock => ({ type: "richText", spans: [{ text }] });
    const blocks = [paragraph("long paragraph"), paragraph("a"), paragraph("b"), paragraph("c")];
    expect(fitEditorialBlockLimit(blocks, stats, 3)).toEqual([
      paragraph("long paragraph"),
      { type: "richText", spans: [{ text: "a" }, { text: " " }, { text: "b" }] },
      paragraph("c"),
    ]);
    expect(stats.mergedBlocks).toBe(1);
  });
});

describe("firstParagraph", () => {
  it("skips short lines and truncates on a word boundary", () => {
    const blocks: EditorialBlock[] = [
      { type: "richText", spans: [{ text: "Short." }] },
      { type: "richText", spans: [{ text: `${"Collecting art is a joy. ".repeat(20)}` }] },
    ];
    const result = firstParagraph(blocks, 60);
    expect(result?.length).toBeLessThanOrEqual(60);
    expect(result?.endsWith("…")).toBe(true);
    expect(firstParagraph([], 60)).toBeNull();
  });
});
