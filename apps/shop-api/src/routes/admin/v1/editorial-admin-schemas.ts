import {
  EditorialBlockListSchema,
  EditorialPlacementSlotSchema,
  EditorialSafeHrefSchema,
  EditorialStoryCategorySchema,
  EditorialStoryKindSchema,
  SeoFieldsWriteProperties,
} from "@auction/shop-contracts";
import { type TSchema, Type } from "@sinclair/typebox";

export const EditorialSlugBodyField = Type.String({
  minLength: 1,
  maxLength: 120,
  pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
});

const HttpsUrlField = Type.String({ minLength: 1, maxLength: 2048, pattern: "^https://" });

/**
 * Fields added after launch: omitted leaves the stored value unchanged on update; `null` clears it.
 * `null` is listed first because Ajv's type coercion would otherwise turn it into "".
 */
const optionalNullable = <T extends TSchema>(schema: T) =>
  Type.Optional(Type.Union([Type.Null(), schema]));
const ShortText = Type.String({ maxLength: 300 });
const PositiveInteger = Type.Integer({ minimum: 1, maximum: 100_000 });

export const EditorialPageWriteBodySchema = Type.Object({
  slug: EditorialSlugBodyField,
  title: Type.String({ minLength: 1, maxLength: 300 }),
  body: EditorialBlockListSchema,
  ...SeoFieldsWriteProperties,
});

export const EditorialVenueWriteBodySchema = Type.Object({
  slug: EditorialSlugBodyField,
  name: Type.String({ minLength: 1, maxLength: 300 }),
  address: Type.Union([Type.String({ maxLength: 500 }), Type.Null()]),
  postcode: Type.Union([Type.String({ maxLength: 32 }), Type.Null()]),
  openingHours: Type.Optional(Type.Union([Type.Unknown(), Type.Null()])),
  phone: Type.Union([Type.String({ maxLength: 64 }), Type.Null()]),
  email: Type.Union([Type.String({ maxLength: 254, format: "email" }), Type.Null()]),
  mapUrl: Type.Union([HttpsUrlField, Type.Null()]),
  coverMediaKey: Type.Union([Type.String({ maxLength: 512 }), Type.Null()]),
  body: EditorialBlockListSchema,
  streetLine: optionalNullable(ShortText),
  city: optionalNullable(Type.String({ maxLength: 120 })),
  latitude: optionalNullable(Type.Number({ minimum: -90, maximum: 90 })),
  longitude: optionalNullable(Type.Number({ minimum: -180, maximum: 180 })),
});

export const EditorialStoryWriteBodySchema = Type.Object({
  slug: EditorialSlugBodyField,
  kind: EditorialStoryKindSchema,
  title: Type.String({ minLength: 1, maxLength: 300 }),
  standfirst: Type.Union([Type.String({ maxLength: 2000 }), Type.Null()]),
  coverMediaKey: Type.Union([Type.String({ maxLength: 512 }), Type.Null()]),
  videoUrl: Type.Union([HttpsUrlField, Type.Null()]),
  featured: Type.Boolean(),
  body: EditorialBlockListSchema,
  ...SeoFieldsWriteProperties,
  category: optionalNullable(EditorialStoryCategorySchema),
  authorName: optionalNullable(ShortText),
  readMinutes: optionalNullable(Type.Integer({ minimum: 1, maximum: 600 })),
  series: optionalNullable(Type.String({ minLength: 1, maxLength: 120 })),
  episodeNumber: optionalNullable(PositiveInteger),
  audioUrl: optionalNullable(HttpsUrlField),
  durationSeconds: optionalNullable(PositiveInteger),
  publicationName: optionalNullable(ShortText),
  externalUrl: optionalNullable(HttpsUrlField),
});

export const EditorialExhibitionWriteBodySchema = Type.Object({
  slug: EditorialSlugBodyField,
  kind: Type.Union([Type.Literal("exhibition"), Type.Literal("film"), Type.Literal("event")]),
  title: Type.String({ minLength: 1, maxLength: 300 }),
  summary: Type.Union([Type.String({ maxLength: 2000 }), Type.Null()]),
  venueId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  startsOn: Type.Union([Type.String({ format: "date" }), Type.Null()]),
  endsOn: Type.Union([Type.String({ format: "date" }), Type.Null()]),
  timesNote: Type.Union([Type.String({ maxLength: 500 }), Type.Null()]),
  coverMediaKey: Type.Union([Type.String({ maxLength: 512 }), Type.Null()]),
  featured: Type.Boolean(),
  body: EditorialBlockListSchema,
  subtitle: optionalNullable(ShortText),
  contactName: optionalNullable(Type.String({ maxLength: 200 })),
  contactRole: optionalNullable(Type.String({ maxLength: 200 })),
  contactEmail: optionalNullable(Type.String({ maxLength: 254, format: "email" })),
  contactPhone: optionalNullable(Type.String({ maxLength: 64 })),
  contactAvatarMediaKey: optionalNullable(Type.String({ maxLength: 512 })),
});

export const EditorialPlacementItemSchema = Type.Object({
  position: Type.Integer({ minimum: 0, maximum: 50 }),
  refKind: Type.Union([
    Type.Literal("exhibition"),
    Type.Literal("story"),
    Type.Literal("page"),
    Type.Literal("venue"),
    Type.Literal("external"),
  ]),
  refId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  headline: Type.Union([Type.String({ maxLength: 300 }), Type.Null()]),
  mediaKey: Type.Union([Type.String({ maxLength: 512 }), Type.Null()]),
  linkUrl: Type.Union([EditorialSafeHrefSchema, Type.Null()]),
  body: optionalNullable(Type.String({ maxLength: 2000 })),
  ctaLabel: optionalNullable(Type.String({ maxLength: 80 })),
});

/** Same slots the storefront reads, so admin and public contracts cannot drift apart. */
export const EditorialPlacementSlotParamSchema = EditorialPlacementSlotSchema;

export const EditorialIdParamsSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
});

export const EditorialCreateResponseSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
});
