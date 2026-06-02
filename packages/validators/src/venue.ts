import { z } from "zod";
import { isUkPostcode, normalizeUkPostcode } from "./onsite-location.js";

const requiredText = (max = 500) => z.string().trim().min(1).max(max);

const optionalText = (max = 500) =>
  z
    .union([z.string().trim().max(max), z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined ? null : v));

const optionalUrl = z
  .union([z.string().url().max(2048), z.literal("")])
  .optional()
  .nullable()
  .transform((v) => (v === "" || v === undefined ? null : v));

const postcodeField = requiredText(16)
  .transform((v) => normalizeUkPostcode(v))
  .superRefine((v, ctx) => {
    if (!isUkPostcode(v)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid UK postcode (e.g. SW1Y 6QU)",
      });
    }
  });

const optionalCoordinate = z
  .union([z.coerce.number().finite(), z.literal("")])
  .optional()
  .nullable()
  .transform((v) => (v === "" || v === undefined ? null : v));

export const createVenueSchema = z.object({
  legalEntityId: z.string().uuid(),
  name: requiredText(200),
  addressLine1: requiredText(500),
  addressLine2: optionalText(500),
  city: requiredText(200),
  county: optionalText(200),
  postcode: postcodeField,
  country: requiredText(100),
  mapUrl: optionalUrl,
  latitude: optionalCoordinate.refine((v) => v == null || (v >= -90 && v <= 90), {
    message: "Latitude must be between -90 and 90",
  }),
  longitude: optionalCoordinate.refine((v) => v == null || (v >= -180 && v <= 180), {
    message: "Longitude must be between -180 and 180",
  }),
  openingHours: z.record(z.string(), z.unknown()).nullable().optional(),
  contactPhone: optionalText(100),
  contactEmail: z
    .union([z.string().email().max(320), z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  website: optionalUrl,
  photos: z.array(z.string().min(1).max(2048)).max(24).optional(),
  capacity: z.coerce.number().int().positive().max(1_000_000).optional().nullable(),
  accessNotes: optionalText(5000),
  parkingNotes: optionalText(5000),
  directionsNotes: optionalText(5000),
});

export const updateVenueSchema = createVenueSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const listVenuesQuerySchema = z.object({
  legalEntityId: z.string().uuid().optional(),
  includeArchived: z.enum(["1"]).optional(),
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const venueIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type CreateVenueBody = z.infer<typeof createVenueSchema>;
export type UpdateVenueBody = z.infer<typeof updateVenueSchema>;
export type ListVenuesQuery = z.infer<typeof listVenuesQuerySchema>;
