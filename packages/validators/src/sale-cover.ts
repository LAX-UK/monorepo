import {
  SALE_COVER_SLOT_NAMES,
  SALE_FEATURED_LOTS_MAX,
  SALE_HOME_PINS_MAX,
  SALE_SUBTITLE_MAX_LENGTH,
} from "@auction/types";
import { z } from "zod";

const COVER_ZOOM_MIN = 1;
const COVER_ZOOM_MAX = 2.5;
const EDGE_TOLERANCE = 1e-6;

const unit = z.number().min(0).max(1);

export const unitPointSchema = z.object({ x: unit, y: unit });

export const unitRectSchema = z
  .object({ x: unit, y: unit, width: z.number().gt(0).max(1), height: z.number().gt(0).max(1) })
  .refine(
    (rect) =>
      rect.x + rect.width <= 1 + EDGE_TOLERANCE && rect.y + rect.height <= 1 + EDGE_TOLERANCE,
    "The area must stay inside the picture",
  );

/** A storage key of a picture already uploaded to LAX storage; web addresses are not accepted. */
const coverStorageKeySchema = z
  .string()
  .min(1)
  .max(1024)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._~!$&'()*+,;=:@/-]*$/, "Must be a storage key")
  .refine((key) => !key.includes("..") && !key.includes("://"), "Must be a storage key");

export const saleCoverSlotNameSchema = z.enum(SALE_COVER_SLOT_NAMES);

export const saleCoverSlotParamsSchema = z.object({
  saleId: z.string().uuid(),
  slot: saleCoverSlotNameSchema,
});

const uploadSourceSchema = z.object({ kind: z.literal("upload"), key: coverStorageKeySchema });

/** A detail of one lot photograph. The server reads the photograph's key from the lot itself. */
const lotSourceSchema = z.object({
  kind: z.literal("lot"),
  lotId: z.string().uuid(),
  imageIndex: z.number().int().min(0).max(49),
  crop: unitRectSchema.optional(),
});

export const setSaleCoverSlotBodySchema = z.object({
  source: z.discriminatedUnion("kind", [uploadSourceSchema, lotSourceSchema]),
  focal: unitPointSchema,
  keep: unitRectSchema.optional(),
  zoom: z.number().min(COVER_ZOOM_MIN).max(COVER_ZOOM_MAX).default(1),
  alt: z.string().trim().min(1, "Describe the picture").max(300),
  toneOverride: z.enum(["light", "dark"]).optional(),
  sideOverride: z.enum(["left", "right"]).optional(),
});

export type SetSaleCoverSlotBody = z.infer<typeof setSaleCoverSlotBodySchema>;

export const saleHomeParamsSchema = z.object({ saleId: z.string().uuid() });

/** What staff choose for the home page: any field left out stays as it is. */
export const updateSaleHomeBodySchema = z
  .object({
    subtitle: z.string().trim().max(SALE_SUBTITLE_MAX_LENGTH).nullable().optional(),
    featuredLotIds: z.array(z.string().uuid()).max(SALE_FEATURED_LOTS_MAX).optional(),
    consignmentDeadline: z.coerce.date().nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Change at least one field");

export type UpdateSaleHomeBody = z.infer<typeof updateSaleHomeBodySchema>;

/** The sales pinned to the home page, first place first. An empty list unpins everything. */
export const replaceHomePinsBodySchema = z.object({
  saleIds: z.array(z.string().uuid()).max(SALE_HOME_PINS_MAX),
});

export type ReplaceHomePinsBody = z.infer<typeof replaceHomePinsBodySchema>;
