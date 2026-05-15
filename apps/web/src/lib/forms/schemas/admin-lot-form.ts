import { lotAuctionTypes } from "@auction/types";
import {
  type CreateLotInput,
  createLotSchema,
  mediaReferenceSchema,
  updateLotSchema,
} from "@auction/validators";
import type { z } from "zod";
import { z as zod } from "zod";

const optionalStr = zod.union([zod.string(), zod.literal("")]);

/** Aligned with admin create/edit lot pages (datetime-local strings). */
export const adminLotFormValuesSchema = zod.object({
  title: zod.string().min(1).max(500),
  description: optionalStr,
  medium: optionalStr,
  dimensions: optionalStr,
  /** Legal entity id — replaces legacy user-based sellerId. */
  sellerLegalEntityId: zod.string().uuid("Choose a seller legal entity"),
  /** Display label for the picker chip (not sent to API). */
  sellerDisplayName: zod.string().optional(),
  categoryIds: zod
    .array(zod.string().uuid())
    .min(1, "Choose at least one category")
    .max(8, "Choose no more than 8 categories"),
  saleId: zod.string().uuid().nullable().optional(),
  lotNumber: zod
    .union([zod.coerce.number().int().positive(), zod.literal("")])
    .nullable()
    .optional(),
  auctionType: zod.enum(lotAuctionTypes),
  startingPrice: zod.string().min(1),
  reservePrice: optionalStr,
  buyNowPrice: optionalStr,
  buyerPremiumRate: optionalStr,
  minBidIncrement: optionalStr,
  dutchDecrementAmount: optionalStr,
  dutchDecrementIntervalMs: optionalStr,
  images: zod.array(mediaReferenceSchema).max(20),
  imageAlts: zod.array(zod.string().max(500)).max(20),
  startTime: zod.string().min(1, "Start time required"),
  endTime: zod.string().min(1, "End time required"),
  artistId: zod.string().uuid().nullable().optional(),
});

export type AdminLotFormValues = zod.infer<typeof adminLotFormValuesSchema>;

function buildCreateLotRaw(v: AdminLotFormValues) {
  const lotNumberRaw =
    v.lotNumber !== null && v.lotNumber !== undefined && v.lotNumber !== ""
      ? Number(v.lotNumber)
      : undefined;
  return {
    title: v.title.trim(),
    description: (v.description && String(v.description).trim()) || undefined,
    medium: (v.medium && String(v.medium).trim()) || undefined,
    dimensions: (v.dimensions && String(v.dimensions).trim()) || undefined,
    sellerLegalEntityId: v.sellerLegalEntityId.trim(),
    categoryIds: v.categoryIds,
    auctionType: v.auctionType,
    startingPrice: v.startingPrice.trim(),
    reservePrice: (v.reservePrice && String(v.reservePrice).trim()) || undefined,
    buyNowPrice: (v.buyNowPrice && String(v.buyNowPrice).trim()) || undefined,
    buyerPremiumRate: (v.buyerPremiumRate && String(v.buyerPremiumRate).trim()) || undefined,
    minBidIncrement: (v.minBidIncrement && String(v.minBidIncrement).trim()) || undefined,
    dutchDecrementAmount:
      (v.dutchDecrementAmount && String(v.dutchDecrementAmount).trim()) || undefined,
    dutchDecrementIntervalMs:
      v.dutchDecrementIntervalMs && String(v.dutchDecrementIntervalMs).trim()
        ? Number.parseInt(String(v.dutchDecrementIntervalMs).trim(), 10)
        : undefined,
    images: v.images.length > 0 ? v.images : undefined,
    startTime: new Date(v.startTime),
    endTime: new Date(v.endTime),
    ...(v.saleId !== undefined ? { saleId: v.saleId } : {}),
    ...(lotNumberRaw !== undefined ? { lotNumber: lotNumberRaw } : {}),
    ...(v.artistId !== undefined ? { artistId: v.artistId } : {}),
  } satisfies z.input<typeof createLotSchema>;
}

export function formValuesToImageAltsPatch(v: AdminLotFormValues): {
  imageAlts: string[] | null;
} {
  const imageAlts = v.images.map((_, index) => (v.imageAlts[index] ?? "").trim());
  return {
    imageAlts: imageAlts.some((alt) => alt.length > 0) ? imageAlts : null,
  };
}

/** Client + server: map form → API; use `data` on success. */
export function safeParseCreateLotFromForm(v: AdminLotFormValues) {
  return createLotSchema.safeParse(buildCreateLotRaw(v));
}

export function formValuesToCreateLotInput(v: AdminLotFormValues): CreateLotInput {
  return createLotSchema.parse(buildCreateLotRaw(v));
}

export function safeParseUpdateLotFromForm(v: AdminLotFormValues) {
  const createParsed = createLotSchema.safeParse(buildCreateLotRaw(v));
  if (!createParsed.success) {
    return createParsed;
  }
  return updateLotSchema.safeParse(createParsed.data);
}
