import {
  type ArtistKind,
  CREATOR_KIND_CONFIG,
  type CreatorAttributeField,
  artistKinds,
} from "@auction/types";
import { z } from "zod";
import { mediaReferenceSchema } from "../media.js";

export const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

/** ISO 3166-1 alpha-2 country code, normalised to upper case. Accepts "" -> undefined. */
export const optionalCountryCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, "Use a 2-letter ISO country code, e.g. GB")
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value.toUpperCase() : undefined));

export const optionalMediaReference = z
  .union([mediaReferenceSchema, z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined));

export const optionalUrl = z
  .string()
  .trim()
  .url()
  .max(2048)
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value : undefined));

export const artistKindEnum = z.enum(artistKinds);

export const artistAdminStatusEnum = z.enum(["pending", "approved", "rejected", "merged_into"]);

/** UUID list of categories (departments) a creator belongs to. */
export const categoryIdsSchema = z.array(z.string().uuid()).max(20).optional();

export const artistIdParamSchema = z.object({
  artistId: z.string().uuid(),
});

/** Builds a zod schema for one declarative attribute field. */
function attributeFieldSchema(field: CreatorAttributeField): z.ZodTypeAny {
  switch (field.type) {
    case "url":
      return z
        .string()
        .trim()
        .url()
        .max(field.maxLength ?? 2048);
    case "year":
      return z
        .string()
        .trim()
        .max(field.maxLength ?? 20);
    default:
      return z
        .string()
        .trim()
        .max(field.maxLength ?? 200);
  }
}

/** Per-kind attributes object schema generated from {@link CREATOR_KIND_CONFIG}.
 * Unknown keys are stripped; every declared key is optional. This is the
 * discriminator-driven validation that makes attributes "depend on the kind". */
export function creatorAttributesSchemaForKind(kind: ArtistKind): z.ZodObject<z.ZodRawShape> {
  const config = CREATOR_KIND_CONFIG[kind] ?? CREATOR_KIND_CONFIG.artist;
  const shape: z.ZodRawShape = {};
  for (const field of config.attributes) {
    shape[field.key] = attributeFieldSchema(field).optional();
  }
  return z.object(shape);
}

/** Parse + normalise raw attributes against a kind, returning only the declared
 * keys that have a non-empty value. Used by services as the authoritative
 * cleaner before persisting to the JSONB column. */
export function parseCreatorAttributes(
  kind: ArtistKind,
  raw: Record<string, unknown> | undefined | null,
): Record<string, string> {
  if (!raw) return {};
  const parsed = creatorAttributesSchemaForKind(kind).safeParse(raw);
  if (!parsed.success) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (typeof value === "string" && value.trim().length > 0) {
      out[key] = value.trim();
    }
  }
  return out;
}

/** Loose attributes input accepted at the HTTP boundary (per-kind validation is
 * applied via superRefine on the create/update bodies). */
export const attributesInputSchema = z.record(z.string().max(2000)).optional();

/** Validates `attributes` against the selected (or implicit `artist`) kind. */
export function refineCreatorAttributes(
  data: { kind?: ArtistKind | undefined; attributes?: Record<string, string> | undefined },
  ctx: z.RefinementCtx,
): void {
  if (!data.attributes) return;
  const result = creatorAttributesSchemaForKind(data.kind ?? "artist").safeParse(data.attributes);
  if (result.success) return;
  for (const issue of result.error.issues) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: issue.message,
      path: ["attributes", ...issue.path],
    });
  }
}
