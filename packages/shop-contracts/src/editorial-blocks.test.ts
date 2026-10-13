import { describe, expect, it } from "vitest";
import {
  isSafeEditorialHref,
  mapEditorialBlockMedia,
  parseEditorialBlocks,
} from "./editorial-blocks.js";

describe("parseEditorialBlocks", () => {
  it("accepts a heading block", () => {
    const blocks = parseEditorialBlocks([{ type: "heading", level: 2, text: "Hello" }]);
    expect(blocks).toHaveLength(1);
  });

  it("rejects unknown block types", () => {
    expect(() => parseEditorialBlocks([{ type: "html", content: "<p>x</p>" }])).toThrow(
      "invalid_editorial_blocks",
    );
  });

  it.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "data:text/html,<script>",
    "//evil.example",
    " /visit",
    "http://insecure.example",
  ])("rejects unsafe link href %s", (href) => {
    expect(() =>
      parseEditorialBlocks([{ type: "cta", title: "Visit", buttonLabel: "Go", href }]),
    ).toThrow("invalid_editorial_blocks");
    expect(() =>
      parseEditorialBlocks([{ type: "richText", spans: [{ text: "x", marks: ["link"], href }] }]),
    ).toThrow("invalid_editorial_blocks");
  });

  it("accepts https, mailto and site-relative hrefs", () => {
    const blocks = parseEditorialBlocks([
      { type: "cta", title: "Visit", buttonLabel: "Go", href: "/visit" },
      { type: "cta", title: "Mail", buttonLabel: "Email", href: "mailto:art@thelax.com" },
      {
        type: "cardGrid",
        items: [{ title: "Guide", linkUrl: "https://thelax.com/guide" }],
      },
    ]);
    expect(blocks).toHaveLength(3);
  });

  it("only accepts https video URLs", () => {
    expect(() => parseEditorialBlocks([{ type: "video", url: "javascript:alert(1)" }])).toThrow(
      "invalid_editorial_blocks",
    );
    expect(parseEditorialBlocks([{ type: "video", url: "https://vimeo.com/1" }])).toHaveLength(1);
  });
});

describe("isSafeEditorialHref", () => {
  it("guards render-time links", () => {
    expect(isSafeEditorialHref("/artists")).toBe(true);
    expect(isSafeEditorialHref("javascript:void(0)")).toBe(false);
    expect(isSafeEditorialHref(undefined)).toBe(false);
  });
});

describe("mapEditorialBlockMedia", () => {
  const resolve = (key: string) => (key.startsWith("missing") ? null : `https://cdn.test/${key}`);

  it("resolves media keys across image-bearing blocks", () => {
    const out = mapEditorialBlockMedia(
      [
        { type: "image", mediaKey: "a.jpg", alt: "A" },
        { type: "gallery", items: [{ type: "image", mediaKey: "b.jpg" }] },
        { type: "video", url: "https://vimeo.com/1", posterMediaKey: "p.jpg" },
        { type: "cardGrid", items: [{ title: "Card", mediaKey: "c.jpg" }] },
        { type: "heading", level: 2, text: "Untouched" },
      ],
      resolve,
    );
    expect(out).toEqual([
      { type: "image", mediaKey: "https://cdn.test/a.jpg", alt: "A" },
      { type: "gallery", items: [{ type: "image", mediaKey: "https://cdn.test/b.jpg" }] },
      { type: "video", url: "https://vimeo.com/1", posterMediaKey: "https://cdn.test/p.jpg" },
      { type: "cardGrid", items: [{ title: "Card", mediaKey: "https://cdn.test/c.jpg" }] },
      { type: "heading", level: 2, text: "Untouched" },
    ]);
  });

  it("drops images that cannot be resolved and collapses a broken pair", () => {
    const out = mapEditorialBlockMedia(
      [
        { type: "image", mediaKey: "missing.jpg" },
        {
          type: "imagePair",
          left: { type: "image", mediaKey: "l.jpg" },
          right: { type: "image", mediaKey: "missing-r.jpg" },
        },
        { type: "gallery", items: [{ type: "image", mediaKey: "missing-g.jpg" }] },
      ],
      resolve,
    );
    expect(out).toEqual([{ type: "image", mediaKey: "https://cdn.test/l.jpg" }]);
  });
});
