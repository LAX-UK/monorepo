import type { EditorialBlock } from "@auction/shop-contracts";
import {
  EDITORIAL_BLOCK_LABELS,
  EDITORIAL_BLOCK_TYPES,
  type EditorialBlockType,
  type EditorialInlineSpan,
} from "./editorial-blocks";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HTTPS_PATTERN = /^https:\/\/[^\s/?#]+[^\s]*$/;
const MAILTO_PATTERN = /^mailto:[^\s]+$/;
const ROOT_RELATIVE_PATTERN = /^\/(?![/\\])[^\s]*$/;

export const EDITORIAL_SLUG_MAX_LENGTH = 120;
export const EDITORIAL_MAX_BLOCKS = 200;

export function isEditorialSlug(value: string): boolean {
  return value.length <= EDITORIAL_SLUG_MAX_LENGTH && SLUG_PATTERN.test(value);
}

export function isHttpsUrl(value: string): boolean {
  return HTTPS_PATTERN.test(value);
}

/** Allowed link targets: `https://…`, `mailto:…`, or a root-relative path with one leading `/`. */
export function isAllowedEditorialHref(value: string): boolean {
  return isHttpsUrl(value) || MAILTO_PATTERN.test(value) || ROOT_RELATIVE_PATTERN.test(value);
}

export const HREF_RULE_MESSAGE = "must start with https://, mailto: or a single /";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function checkSpans(spans: unknown, field: string, issues: string[]) {
  if (!Array.isArray(spans) || spans.length === 0) {
    issues.push(`${field} is required`);
    return;
  }
  const typed = spans as EditorialInlineSpan[];
  if (typed.every((span) => !text(span?.text))) {
    issues.push(`${field} is required`);
  }
  for (const span of typed) {
    const href = text(span?.href);
    if (href && !isAllowedEditorialHref(href)) {
      issues.push(`${field} link ${HREF_RULE_MESSAGE}`);
    }
  }
}

function checkImage(image: unknown, field: string, issues: string[]) {
  if (!text((image as { mediaKey?: unknown } | undefined)?.mediaKey)) {
    issues.push(`${field} needs an uploaded image`);
  }
}

function checkSlugs(slugs: unknown, field: string, issues: string[]) {
  if (!Array.isArray(slugs) || slugs.length === 0) {
    issues.push(`${field} needs at least one slug`);
  } else if (slugs.length > 24) {
    issues.push(`${field} allows at most 24 slugs`);
  }
}

function blockIssues(block: EditorialBlock): string[] {
  const issues: string[] = [];
  switch (block.type) {
    case "heading":
      if (!text(block.text)) issues.push("text is required");
      if (![2, 3, 4].includes(block.level)) issues.push("level must be 2, 3 or 4");
      break;
    case "richText":
      checkSpans(block.spans, "paragraph text", issues);
      break;
    case "quote":
      if (!text(block.text)) issues.push("quote text is required");
      break;
    case "image":
      checkImage(block, "image", issues);
      break;
    case "imagePair":
      checkImage(block.left, "left image", issues);
      checkImage(block.right, "right image", issues);
      break;
    case "gallery":
      if (!Array.isArray(block.items) || block.items.length === 0 || block.items.length > 12) {
        issues.push("gallery needs 1 to 12 images");
      } else {
        block.items.forEach((item, i) => checkImage(item, `gallery image ${i + 1}`, issues));
      }
      break;
    case "video": {
      const url = text(block.url);
      if (!url) issues.push("video URL is required");
      else if (!isHttpsUrl(url)) issues.push("video URL must start with https://");
      break;
    }
    case "faqGroup":
      if (!Array.isArray(block.items) || block.items.length === 0) {
        issues.push("add at least one question");
      } else {
        block.items.forEach((item, i) => {
          if (!text(item?.question)) issues.push(`question ${i + 1} is required`);
          checkSpans(item?.answer, `answer ${i + 1}`, issues);
        });
      }
      break;
    case "cardGrid":
      if (!Array.isArray(block.items) || block.items.length === 0 || block.items.length > 12) {
        issues.push("card grid needs 1 to 12 cards");
      } else {
        block.items.forEach((item, i) => {
          if (!text(item?.title)) issues.push(`card ${i + 1} title is required`);
          const link = text(item?.linkUrl);
          if (link && !isAllowedEditorialHref(link)) {
            issues.push(`card ${i + 1} link ${HREF_RULE_MESSAGE}`);
          }
        });
      }
      break;
    case "cta": {
      if (!text(block.title)) issues.push("title is required");
      if (!text(block.buttonLabel)) issues.push("button label is required");
      const href = text(block.href);
      if (!href) issues.push("link is required");
      else if (!isAllowedEditorialHref(href)) issues.push(`link ${HREF_RULE_MESSAGE}`);
      break;
    }
    case "artworkRail":
      checkSlugs(block.artworkSlugs, "artwork rail", issues);
      break;
    case "artistRail":
      checkSlugs(block.artistSlugs, "artist rail", issues);
      break;
    case "infoStrip":
      if (!text(block.dateLabel) && !text(block.venueLabel) && !text(block.hoursLabel)) {
        issues.push("fill in at least one label");
      }
      break;
  }
  return issues;
}

/** Returns human-readable problems; an empty list means the blocks are ready to save. */
export function validateEditorialBlocks(blocks: readonly EditorialBlock[]): string[] {
  if (blocks.length > EDITORIAL_MAX_BLOCKS) {
    return [`A body can hold at most ${EDITORIAL_MAX_BLOCKS} blocks.`];
  }
  return blocks.flatMap((block, index) => {
    const type = (block as { type?: unknown } | null)?.type as EditorialBlockType;
    if (!EDITORIAL_BLOCK_TYPES.includes(type)) {
      return [`Block ${index + 1}: unknown block type.`];
    }
    const label = EDITORIAL_BLOCK_LABELS[type];
    return blockIssues(block).map((issue) => `Block ${index + 1} (${label}): ${issue}.`);
  });
}
