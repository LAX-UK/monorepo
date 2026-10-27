import type { EditorialBlock } from "@auction/shop-contracts";

export type EditorialBlockType = EditorialBlock["type"];
export type EditorialBlockOf<T extends EditorialBlockType> = Extract<EditorialBlock, { type: T }>;
export type EditorialInlineSpan = EditorialBlockOf<"richText">["spans"][number];

export type EditorialBlockItem = { key: string; block: EditorialBlock };

export const EDITORIAL_BLOCK_LABELS: Record<EditorialBlockType, string> = {
  heading: "Heading",
  richText: "Paragraph",
  quote: "Quote",
  image: "Image",
  imagePair: "Image pair",
  gallery: "Gallery",
  video: "Video",
  faqGroup: "FAQ group",
  cardGrid: "Card grid",
  cta: "Call to action",
  artworkRail: "Artwork rail",
  artistRail: "Artist rail",
  infoStrip: "Info strip",
};

export const EDITORIAL_BLOCK_TYPES = Object.keys(EDITORIAL_BLOCK_LABELS) as EditorialBlockType[];

/** Block types edited only through the per-block JSON fallback. */
const JSON_ONLY_BLOCK_TYPES: ReadonlySet<EditorialBlockType> = new Set(["imagePair", "gallery"]);

export function createEditorialBlock(type: EditorialBlockType): EditorialBlock {
  switch (type) {
    case "heading":
      return { type, level: 2, text: "" };
    case "richText":
      return { type, spans: [{ text: "" }] };
    case "quote":
      return { type, text: "" };
    case "image":
      return { type, mediaKey: "" };
    case "imagePair":
      return {
        type,
        left: { type: "image", mediaKey: "" },
        right: { type: "image", mediaKey: "" },
      };
    case "gallery":
      return { type, items: [{ type: "image", mediaKey: "" }] };
    case "video":
      return { type, url: "" };
    case "faqGroup":
      return { type, items: [{ question: "", answer: [{ text: "" }] }] };
    case "cardGrid":
      return { type, items: [{ title: "" }] };
    case "cta":
      return { type, title: "", buttonLabel: "", href: "" };
    case "artworkRail":
      return { type, artworkSlugs: [] };
    case "artistRail":
      return { type, artistSlugs: [] };
    case "infoStrip":
      return { type };
  }
}

export function toBlockItems(
  blocks: readonly EditorialBlock[],
  makeKey: () => string,
): EditorialBlockItem[] {
  return blocks.map((block) => ({ key: makeKey(), block }));
}

export function fromBlockItems(items: readonly EditorialBlockItem[]): EditorialBlock[] {
  return items.map((item) => item.block);
}

/** Sets an optional string field, omitting the key entirely when the value is empty. */
export function withOptionalText<T extends object>(
  obj: T,
  key: keyof T & string,
  value: string,
): T {
  const next: Record<string, unknown> = { ...(obj as Record<string, unknown>) };
  if (value === "") delete next[key];
  else next[key] = value;
  return next as T;
}

/**
 * Whether a block has a form. Paragraphs and FAQ answers are edited as formatted text, so any
 * run list opens in the form; only blocks that carry no form at all, and blocks whose shape is
 * not what the form expects, fall back to JSON.
 */
export function isStructuredBlock(block: EditorialBlock): boolean {
  if (!EDITORIAL_BLOCK_TYPES.includes(block.type) || JSON_ONLY_BLOCK_TYPES.has(block.type)) {
    return false;
  }
  if (block.type === "richText") return Array.isArray(block.spans);
  if (block.type === "faqGroup") {
    return (
      Array.isArray(block.items) &&
      block.items.every((item) => Array.isArray(item.answer) && typeof item.question === "string")
    );
  }
  return true;
}

export type ParseBlocksResult =
  | { ok: true; blocks: EditorialBlock[] }
  | { ok: false; error: string };

export function parseBlocksJson(text: string): ParseBlocksResult {
  if (!text.trim()) return { ok: true, blocks: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "Invalid JSON." };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: "Body must be a JSON array of blocks." };
  }
  const unknownIndex = parsed.findIndex(
    (block) =>
      !block ||
      typeof block !== "object" ||
      !EDITORIAL_BLOCK_TYPES.includes((block as { type?: unknown }).type as EditorialBlockType),
  );
  if (unknownIndex >= 0) {
    return { ok: false, error: `Block ${unknownIndex + 1} has an unknown or missing type.` };
  }
  return { ok: true, blocks: parsed as EditorialBlock[] };
}

export function parseSingleBlockJson(text: string): ParseBlocksResult {
  const result = parseBlocksJson(`[${text}]`);
  if (!result.ok) return result;
  if (result.blocks.length !== 1) return { ok: false, error: "Enter exactly one block object." };
  return result;
}
