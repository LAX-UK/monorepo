import type { EditorialBlock } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  isAllowedEditorialHref,
  isEditorialSlug,
  isHttpsUrl,
  validateEditorialBlocks,
} from "./editorial-validation";

describe("isEditorialSlug", () => {
  it.each(["how-to-buy", "a1", "x"])("accepts %s", (slug) => {
    expect(isEditorialSlug(slug)).toBe(true);
  });

  it.each(["", "How", "a--b", "-a", "a-", "a b", "a_b", "x".repeat(121)])("rejects %j", (slug) => {
    expect(isEditorialSlug(slug)).toBe(false);
  });
});

describe("isAllowedEditorialHref", () => {
  it.each(["https://lax.art/x", "mailto:hello@lax.art", "/", "/visit", "/stories/a?b=1"])(
    "accepts %s",
    (href) => {
      expect(isAllowedEditorialHref(href)).toBe(true);
    },
  );

  it.each([
    "http://lax.art",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "visit",
    "https://",
    "mailto:",
    "/a b",
  ])("rejects %s", (href) => {
    expect(isAllowedEditorialHref(href)).toBe(false);
  });

  it("only allows https for plain URLs", () => {
    expect(isHttpsUrl("https://youtu.be/x")).toBe(true);
    expect(isHttpsUrl("/x")).toBe(false);
  });
});

describe("validateEditorialBlocks", () => {
  it("accepts complete blocks", () => {
    const blocks: EditorialBlock[] = [
      { type: "heading", level: 2, text: "Hello" },
      { type: "richText", spans: [{ text: "Body", marks: ["link"], href: "/visit" }] },
      { type: "image", mediaKey: "editorial/a.jpg" },
      { type: "cta", title: "Visit", buttonLabel: "Plan", href: "mailto:a@b.co" },
      { type: "artworkRail", artworkSlugs: ["a"] },
      { type: "video", url: "https://vimeo.com/1" },
      { type: "infoStrip", dateLabel: "Now on" },
    ];
    expect(validateEditorialBlocks(blocks)).toEqual([]);
  });

  it("reports missing required fields with block position and label", () => {
    expect(
      validateEditorialBlocks([
        { type: "quote", text: "ok" },
        { type: "heading", level: 2, text: "  " },
      ]),
    ).toEqual(["Block 2 (Heading): text is required."]);
  });

  it("rejects disallowed hrefs in paragraphs, cards, FAQ answers and CTAs", () => {
    const issues = validateEditorialBlocks([
      { type: "richText", spans: [{ text: "x", href: "http://a.b" }] },
      { type: "cardGrid", items: [{ title: "t", linkUrl: "//a.b" }] },
      { type: "faqGroup", items: [{ question: "q", answer: [{ text: "a", href: "ftp://x" }] }] },
      { type: "cta", title: "t", buttonLabel: "b", href: "javascript:x" },
    ]);
    expect(issues).toHaveLength(4);
    expect(issues.every((issue) => issue.includes("must start with https://"))).toBe(true);
  });

  it("requires uploaded images, rail slugs and https video URLs", () => {
    expect(
      validateEditorialBlocks([
        { type: "image", mediaKey: "" },
        { type: "artistRail", artistSlugs: [] },
        { type: "video", url: "/local.mp4" },
        { type: "infoStrip" },
      ]),
    ).toEqual([
      "Block 1 (Image): image needs an uploaded image.",
      "Block 2 (Artist rail): artist rail needs at least one slug.",
      "Block 3 (Video): video URL must start with https://.",
      "Block 4 (Info strip): fill in at least one label.",
    ]);
  });

  it("flags unknown block types from the JSON editor", () => {
    expect(validateEditorialBlocks([{ type: "marquee" } as unknown as EditorialBlock])).toEqual([
      "Block 1: unknown block type.",
    ]);
  });
});
