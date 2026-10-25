import { legalEntityFacts, legalEntityFor } from "@auction/branding";
import type { ShopPolicyBlock, ShopPolicyDocument, ShopPolicyText } from "./shop-policy.types";

export type ShopPolicyTextPart =
  | { kind: "text"; value: string }
  | { kind: "strong"; value: string }
  | { kind: "link"; label: string; href: string }
  | { kind: "placeholder"; value: string };

const INLINE_MARK = /\[TO CONFIRM: ([^\]]+)\]|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
const PLACEHOLDER = /\[TO CONFIRM: ([^\]]+)\]/g;

export function parseShopPolicyText(text: ShopPolicyText): ShopPolicyTextPart[] {
  const parts: ShopPolicyTextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(INLINE_MARK)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ kind: "text", value: text.slice(cursor, index) });
    const [whole, placeholder, label, href, strong] = match;
    if (placeholder !== undefined) parts.push({ kind: "placeholder", value: placeholder });
    else if (label !== undefined && href !== undefined) parts.push({ kind: "link", label, href });
    else if (strong !== undefined) parts.push({ kind: "strong", value: strong });
    cursor = index + whole.length;
  }
  if (cursor < text.length) parts.push({ kind: "text", value: text.slice(cursor) });
  return parts;
}

function blockTexts(block: ShopPolicyBlock): string[] {
  switch (block.type) {
    case "paragraph":
    case "subheading":
      return [block.text];
    case "list":
      return [...block.items];
    case "table":
      return [block.caption, ...block.columns, ...block.rows.flat()];
    case "panel":
      return [block.title, ...block.blocks.flatMap(blockTexts)];
    case "company":
      return Object.values(legalEntityFacts(legalEntityFor("shop")));
  }
}

/** Every string in the document, in reading order. */
export function shopPolicyTexts(document: ShopPolicyDocument): string[] {
  return [
    document.title,
    document.summary,
    ...document.sections.flatMap((section) => [
      section.heading,
      ...section.blocks.flatMap(blockTexts),
    ]),
  ];
}

/** The `[TO CONFIRM: …]` placeholders still to fill, in reading order. */
export function shopPolicyPlaceholders(document: ShopPolicyDocument): string[] {
  return shopPolicyTexts(document).flatMap((text) =>
    [...text.matchAll(PLACEHOLDER)].map((match) => match[1] ?? ""),
  );
}
