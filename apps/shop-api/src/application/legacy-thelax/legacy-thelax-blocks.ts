import {
  type EditorialBlock,
  type EditorialInlineSpan,
  isSafeEditorialHref,
  parseEditorialBlocks,
} from "@auction/shop-contracts";

export const EDITORIAL_BLOCK_LIMIT = 200;

const LEGACY_HOSTS = new Set(["thelax.art", "www.thelax.art", "lax.art", "www.lax.art"]);

/** Redirect-map key for a legacy URL (glossary letter queries collapse onto `/glossary`). */
export function legacyLookupKey(url: URL): string {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return path;
}

export function isLegacyHost(url: URL): boolean {
  return LEGACY_HOSTS.has(url.hostname.toLowerCase());
}

export type LegacyBlockRewriter = {
  /** New path (or absolute URL) for a legacy path; `null` when it has no equivalent. */
  resolveLegacyPath(path: string): string | null;
  /** Imports a legacy image and returns its media key, or `null` when it cannot be imported. */
  importImage(url: string, alt: string | null): Promise<string | null>;
};

export type LegacyBlockStats = {
  droppedBlocks: number;
  droppedLinks: number;
  mergedBlocks: number;
};

export function emptyBlockStats(): LegacyBlockStats {
  return { droppedBlocks: 0, droppedLinks: 0, mergedBlocks: 0 };
}

function rewriteHref(
  href: string,
  rewriter: LegacyBlockRewriter,
  stats: LegacyBlockStats,
): string | undefined {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    stats.droppedLinks += 1;
    return undefined;
  }
  if (url.protocol === "mailto:") return href;
  if (isLegacyHost(url)) {
    const target = rewriter.resolveLegacyPath(legacyLookupKey(url));
    if (target && isSafeEditorialHref(target)) return target;
    stats.droppedLinks += 1;
    return undefined;
  }
  if (url.protocol === "https:" && isSafeEditorialHref(url.href)) return url.href;
  stats.droppedLinks += 1;
  return undefined;
}

function rewriteSpans(
  spans: readonly EditorialInlineSpan[],
  rewriter: LegacyBlockRewriter,
  stats: LegacyBlockStats,
): EditorialInlineSpan[] {
  return spans.map((span) => {
    if (span.href === undefined) return span;
    const href = rewriteHref(span.href, rewriter, stats);
    const { href: _legacy, ...rest } = span;
    return href ? { ...rest, href } : rest;
  });
}

function isValidBlock(block: unknown): block is EditorialBlock {
  try {
    parseEditorialBlocks([block]);
    return true;
  } catch {
    return false;
  }
}

async function rewriteBlock(
  block: unknown,
  rewriter: LegacyBlockRewriter,
  stats: LegacyBlockStats,
): Promise<unknown> {
  if (typeof block !== "object" || block === null) return null;
  const typed = block as { type?: unknown } & Record<string, unknown>;
  switch (typed.type) {
    case "richText":
      return {
        ...typed,
        spans: rewriteSpans((typed.spans ?? []) as EditorialInlineSpan[], rewriter, stats),
      };
    case "faqGroup":
      return {
        ...typed,
        items: ((typed.items ?? []) as Array<{ answer?: EditorialInlineSpan[] }>).map((item) => ({
          ...item,
          answer: rewriteSpans(item.answer ?? [], rewriter, stats),
        })),
      };
    case "image": {
      const alt = typeof typed.alt === "string" ? typed.alt : null;
      const mediaKey =
        typeof typed.mediaKey === "string" ? await rewriter.importImage(typed.mediaKey, alt) : null;
      return mediaKey ? { ...typed, mediaKey } : null;
    }
    default:
      return typed;
  }
}

function blockTextLength(block: EditorialBlock): number {
  return block.type === "richText" ? block.spans.reduce((n, s) => n + s.text.length, 0) : 0;
}

/** Merges the shortest adjacent paragraph pairs until the list fits the editorial block cap. */
export function fitEditorialBlockLimit(
  blocks: EditorialBlock[],
  stats: LegacyBlockStats,
  limit = EDITORIAL_BLOCK_LIMIT,
): EditorialBlock[] {
  const out = [...blocks];
  while (out.length > limit) {
    let best = -1;
    let bestLength = Number.POSITIVE_INFINITY;
    for (let i = 0; i < out.length - 1; i += 1) {
      const left = out[i];
      const right = out[i + 1];
      if (left?.type !== "richText" || right?.type !== "richText") continue;
      const length = blockTextLength(left) + blockTextLength(right);
      if (length < bestLength) {
        best = i;
        bestLength = length;
      }
    }
    if (best < 0) {
      stats.droppedBlocks += out.length - limit;
      return out.slice(0, limit);
    }
    const left = out[best] as Extract<EditorialBlock, { type: "richText" }>;
    const right = out[best + 1] as Extract<EditorialBlock, { type: "richText" }>;
    out.splice(best, 2, {
      type: "richText",
      spans: [...left.spans, { text: " " }, ...right.spans],
    });
    stats.mergedBlocks += 1;
  }
  return out;
}

/**
 * Rewrites legacy blocks for the new site: images are imported, legacy links follow the
 * redirect map, unsafe or dead links lose their href, and invalid blocks are dropped.
 */
export async function rewriteLegacyBlocks(
  blocks: readonly unknown[],
  rewriter: LegacyBlockRewriter,
  stats: LegacyBlockStats,
): Promise<EditorialBlock[]> {
  const out: EditorialBlock[] = [];
  for (const block of blocks) {
    const rewritten = await rewriteBlock(block, rewriter, stats);
    if (rewritten && isValidBlock(rewritten)) out.push(rewritten);
    else stats.droppedBlocks += 1;
  }
  return fitEditorialBlockLimit(out, stats);
}

export function firstParagraph(
  blocks: readonly EditorialBlock[],
  maxLength: number,
): string | null {
  for (const block of blocks) {
    if (block.type !== "richText") continue;
    const text = block.spans
      .map((span) => span.text)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length < 40) continue;
    if (text.length <= maxLength) return text;
    const cut = text.slice(0, maxLength - 1);
    const lastSpace = cut.lastIndexOf(" ");
    return `${(lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
  }
  return null;
}
