import type { EditorialBlock, EditorialInlineSpan } from "./editorial-blocks.js";

/** Typical adult silent-reading speed for non-fiction prose. */
const WORDS_PER_MINUTE = 230;

function spansText(spans: readonly EditorialInlineSpan[]): string {
  return spans.map((span) => span.text).join("");
}

/** Prose a reader reads through; captions, alt text and rails are glanced at, so they don't count. */
function blockText(block: EditorialBlock): string {
  switch (block.type) {
    case "heading":
    case "quote":
      return block.text;
    case "richText":
      return spansText(block.spans);
    case "faqGroup":
      return block.items.map((item) => `${item.question} ${spansText(item.answer)}`).join(" ");
    case "cardGrid":
      return block.items.map((item) => `${item.title} ${item.body ?? ""}`).join(" ");
    case "cta":
      return `${block.title} ${block.body ?? ""}`;
    default:
      return "";
  }
}

/** The prose of a body as one line of text, for matching a search term against it. */
export function editorialBlocksPlainText(blocks: readonly EditorialBlock[]): string {
  return blocks
    .map(blockText)
    .filter((text) => text.length > 0)
    .join(" ");
}

function countEditorialWords(blocks: readonly EditorialBlock[]): number {
  return blocks.reduce((total, block) => {
    const words = blockText(block).trim().split(/\s+/u).filter(Boolean);
    return total + words.length;
  }, 0);
}

/**
 * Minutes to read a story body at ~230 words per minute, rounded up so a short piece reads
 * "1 min" rather than "0 min". Null for a body with no prose (a film or podcast page).
 */
export function estimateEditorialReadMinutes(blocks: readonly EditorialBlock[]): number | null {
  const words = countEditorialWords(blocks);
  return words === 0 ? null : Math.ceil(words / WORDS_PER_MINUTE);
}
