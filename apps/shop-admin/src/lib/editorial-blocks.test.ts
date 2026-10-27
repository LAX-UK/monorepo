import type { EditorialBlock } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  EDITORIAL_BLOCK_TYPES,
  createEditorialBlock,
  fromBlockItems,
  isStructuredBlock,
  parseBlocksJson,
  parseSingleBlockJson,
  toBlockItems,
  withOptionalText,
} from "./editorial-blocks";

describe("createEditorialBlock", () => {
  it("creates a block of every supported type", () => {
    for (const type of EDITORIAL_BLOCK_TYPES) {
      expect(createEditorialBlock(type).type).toBe(type);
    }
  });
});

describe("block items", () => {
  it("round-trips blocks with generated keys", () => {
    let n = 0;
    const blocks: EditorialBlock[] = [{ type: "quote", text: "Hi" }, { type: "infoStrip" }];
    const items = toBlockItems(blocks, () => `k${++n}`);
    expect(items.map((item) => item.key)).toEqual(["k1", "k2"]);
    expect(fromBlockItems(items)).toEqual(blocks);
  });
});

describe("withOptionalText", () => {
  it("sets a value or omits the key when blank", () => {
    const quote: EditorialBlock = { type: "quote", text: "x", attribution: "A" };
    expect(withOptionalText(quote, "attribution", "B")).toEqual({
      type: "quote",
      text: "x",
      attribution: "B",
    });
    expect(withOptionalText(quote, "attribution", "")).toEqual({ type: "quote", text: "x" });
    expect(quote).toHaveProperty("attribution", "A");
  });
});

describe("isStructuredBlock", () => {
  it("sends only blocks without a form to the JSON fallback", () => {
    expect(isStructuredBlock({ type: "heading", level: 2, text: "x" })).toBe(true);
    expect(isStructuredBlock(createEditorialBlock("gallery"))).toBe(false);
    expect(isStructuredBlock(createEditorialBlock("imagePair"))).toBe(false);
  });

  it("opens formatted paragraphs and FAQ answers in the form", () => {
    expect(
      isStructuredBlock({
        type: "richText",
        spans: [{ text: "a" }, { text: "b", marks: ["bold"] }],
      }),
    ).toBe(true);
    expect(
      isStructuredBlock({
        type: "faqGroup",
        items: [
          {
            question: "q",
            answer: [
              { text: "a", marks: ["italic"] },
              { text: "b", marks: ["link"], href: "/x" },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  it("falls back to JSON for a paragraph or FAQ whose shape the form cannot read", () => {
    expect(isStructuredBlock({ type: "richText" } as unknown as EditorialBlock)).toBe(false);
    expect(
      isStructuredBlock({
        type: "faqGroup",
        items: [{ question: "q" }],
      } as unknown as EditorialBlock),
    ).toBe(false);
  });
});

describe("parseBlocksJson", () => {
  it("accepts an empty string as no blocks", () => {
    expect(parseBlocksJson("  ")).toEqual({ ok: true, blocks: [] });
  });

  it("rejects invalid JSON, non-arrays and unknown block types", () => {
    expect(parseBlocksJson("{")).toEqual({ ok: false, error: "Invalid JSON." });
    expect(parseBlocksJson("{}").ok).toBe(false);
    expect(parseBlocksJson('[{"type":"heading"},{"type":"marquee"}]')).toEqual({
      ok: false,
      error: "Block 2 has an unknown or missing type.",
    });
  });

  it("parses a single block object", () => {
    expect(parseSingleBlockJson('{"type":"quote","text":"x"}')).toEqual({
      ok: true,
      blocks: [{ type: "quote", text: "x" }],
    });
    expect(parseSingleBlockJson('{"type":"quote"},{"type":"quote"}').ok).toBe(false);
  });
});
