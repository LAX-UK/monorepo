import { Type } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";

/** https, mailto, or a site-relative path; rejects `javascript:`, `data:` and `//host` URLs. */
export const EDITORIAL_SAFE_HREF_PATTERN = "^(?:https://|mailto:|/(?![/\\\\]))";

const SAFE_HREF = new RegExp(EDITORIAL_SAFE_HREF_PATTERN);

export function isSafeEditorialHref(href: string | null | undefined): href is string {
  return typeof href === "string" && SAFE_HREF.test(href);
}

export const EditorialSafeHrefSchema = Type.String({
  minLength: 1,
  maxLength: 2048,
  pattern: EDITORIAL_SAFE_HREF_PATTERN,
});

const InlineMarkSchema = Type.Union([
  Type.Literal("bold"),
  Type.Literal("italic"),
  Type.Literal("link"),
]);

export const EditorialInlineSpanSchema = Type.Object({
  text: Type.String(),
  marks: Type.Optional(Type.Array(InlineMarkSchema)),
  href: Type.Optional(EditorialSafeHrefSchema),
});

export const EditorialRichTextBlockSchema = Type.Object({
  type: Type.Literal("richText"),
  spans: Type.Array(EditorialInlineSpanSchema),
});

export const EditorialHeadingBlockSchema = Type.Object({
  type: Type.Literal("heading"),
  level: Type.Union([Type.Literal(2), Type.Literal(3), Type.Literal(4)]),
  text: Type.String({ minLength: 1, maxLength: 500 }),
});

export const EditorialQuoteBlockSchema = Type.Object({
  type: Type.Literal("quote"),
  text: Type.String({ minLength: 1, maxLength: 2000 }),
  attribution: Type.Optional(Type.String({ maxLength: 200 })),
});

/** Admin writes carry storage keys; public reads return the resolved absolute URL in `mediaKey`. */
export const EditorialImageBlockSchema = Type.Object({
  type: Type.Literal("image"),
  mediaKey: Type.String({ minLength: 1, maxLength: 2048 }),
  alt: Type.Optional(Type.String({ maxLength: 500 })),
  caption: Type.Optional(Type.String({ maxLength: 1000 })),
});

export const EditorialImagePairBlockSchema = Type.Object({
  type: Type.Literal("imagePair"),
  left: EditorialImageBlockSchema,
  right: EditorialImageBlockSchema,
});

export const EditorialGalleryBlockSchema = Type.Object({
  type: Type.Literal("gallery"),
  items: Type.Array(EditorialImageBlockSchema, { minItems: 1, maxItems: 12 }),
});

export const EditorialVideoBlockSchema = Type.Object({
  type: Type.Literal("video"),
  url: Type.String({ minLength: 1, maxLength: 2048, pattern: "^https://" }),
  title: Type.Optional(Type.String({ maxLength: 200 })),
  posterMediaKey: Type.Optional(Type.String({ maxLength: 2048 })),
});

export const EditorialFaqItemSchema = Type.Object({
  question: Type.String({ minLength: 1, maxLength: 500 }),
  answer: Type.Array(EditorialInlineSpanSchema, { minItems: 1 }),
});

export const EditorialFaqGroupBlockSchema = Type.Object({
  type: Type.Literal("faqGroup"),
  items: Type.Array(EditorialFaqItemSchema, { minItems: 1 }),
});

export const EditorialCardGridItemSchema = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 200 }),
  body: Type.Optional(Type.String({ maxLength: 1000 })),
  linkUrl: Type.Optional(EditorialSafeHrefSchema),
  mediaKey: Type.Optional(Type.String({ maxLength: 2048 })),
});

export const EditorialCardGridBlockSchema = Type.Object({
  type: Type.Literal("cardGrid"),
  items: Type.Array(EditorialCardGridItemSchema, { minItems: 1, maxItems: 12 }),
});

export const EditorialCtaBlockSchema = Type.Object({
  type: Type.Literal("cta"),
  title: Type.String({ minLength: 1, maxLength: 200 }),
  body: Type.Optional(Type.String({ maxLength: 1000 })),
  buttonLabel: Type.String({ minLength: 1, maxLength: 80 }),
  href: EditorialSafeHrefSchema,
});

export const EditorialArtworkRailBlockSchema = Type.Object({
  type: Type.Literal("artworkRail"),
  headline: Type.Optional(Type.String({ maxLength: 200 })),
  artworkSlugs: Type.Array(Type.String({ minLength: 1 }), { minItems: 1, maxItems: 24 }),
});

export const EditorialArtistRailBlockSchema = Type.Object({
  type: Type.Literal("artistRail"),
  headline: Type.Optional(Type.String({ maxLength: 200 })),
  artistSlugs: Type.Array(Type.String({ minLength: 1 }), { minItems: 1, maxItems: 24 }),
});

export const EditorialInfoStripBlockSchema = Type.Object({
  type: Type.Literal("infoStrip"),
  dateLabel: Type.Optional(Type.String({ maxLength: 120 })),
  venueLabel: Type.Optional(Type.String({ maxLength: 200 })),
  hoursLabel: Type.Optional(Type.String({ maxLength: 200 })),
});

export const EditorialBlockSchema = Type.Union([
  EditorialHeadingBlockSchema,
  EditorialRichTextBlockSchema,
  EditorialQuoteBlockSchema,
  EditorialImageBlockSchema,
  EditorialImagePairBlockSchema,
  EditorialGalleryBlockSchema,
  EditorialVideoBlockSchema,
  EditorialFaqGroupBlockSchema,
  EditorialCardGridBlockSchema,
  EditorialCtaBlockSchema,
  EditorialArtworkRailBlockSchema,
  EditorialArtistRailBlockSchema,
  EditorialInfoStripBlockSchema,
]);

export const EditorialBlockListSchema = Type.Array(EditorialBlockSchema, { maxItems: 200 });

export type EditorialBlock = typeof EditorialBlockSchema.static;
export type EditorialImageBlock = typeof EditorialImageBlockSchema.static;
export type EditorialInlineSpan = typeof EditorialInlineSpanSchema.static;

const blockListValidator = TypeCompiler.Compile(EditorialBlockListSchema);

export function parseEditorialBlocks(value: unknown): EditorialBlock[] {
  if (!blockListValidator.Check(value)) {
    throw new Error("invalid_editorial_blocks");
  }
  return value as EditorialBlock[];
}

/** Rewrites every media key in a block list (storage key → public URL). Unresolvable media is dropped. */
export function mapEditorialBlockMedia(
  blocks: readonly EditorialBlock[],
  resolve: (mediaKey: string) => string | null,
): EditorialBlock[] {
  const image = (block: EditorialImageBlock): EditorialImageBlock | null => {
    const url = resolve(block.mediaKey);
    return url ? { ...block, mediaKey: url } : null;
  };
  const out: EditorialBlock[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "image": {
        const mapped = image(block);
        if (mapped) out.push(mapped);
        break;
      }
      case "imagePair": {
        const left = image(block.left);
        const right = image(block.right);
        if (left && right) out.push({ ...block, left, right });
        else if (left ?? right) out.push((left ?? right) as EditorialImageBlock);
        break;
      }
      case "gallery": {
        const items = block.items.map(image).filter((item) => item !== null);
        if (items.length > 0) out.push({ ...block, items });
        break;
      }
      case "video": {
        const { posterMediaKey, ...rest } = block;
        const poster = posterMediaKey ? resolve(posterMediaKey) : null;
        out.push(poster ? { ...rest, posterMediaKey: poster } : rest);
        break;
      }
      case "cardGrid":
        out.push({
          ...block,
          items: block.items.map(({ mediaKey, ...item }) => {
            const url = mediaKey ? resolve(mediaKey) : null;
            return url ? { ...item, mediaKey: url } : item;
          }),
        });
        break;
      default:
        out.push(block);
    }
  }
  return out;
}
