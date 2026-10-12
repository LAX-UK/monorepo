import { EditorialBlockListSchema, EditorialSafeHrefSchema } from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";

export const EditorialSlugBodyField = Type.String({
  minLength: 1,
  maxLength: 120,
  pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
});

const HttpsUrlField = Type.String({ minLength: 1, maxLength: 2048, pattern: "^https://" });

export const EditorialPageWriteBodySchema = Type.Object({
  slug: EditorialSlugBodyField,
  title: Type.String({ minLength: 1, maxLength: 300 }),
  body: EditorialBlockListSchema,
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
});

export const EditorialStoryWriteBodySchema = Type.Object({
  slug: EditorialSlugBodyField,
  kind: Type.Union([
    Type.Literal("article"),
    Type.Literal("film"),
    Type.Literal("press"),
    Type.Literal("guide"),
  ]),
  title: Type.String({ minLength: 1, maxLength: 300 }),
  standfirst: Type.Union([Type.String({ maxLength: 2000 }), Type.Null()]),
  coverMediaKey: Type.Union([Type.String({ maxLength: 512 }), Type.Null()]),
  videoUrl: Type.Union([HttpsUrlField, Type.Null()]),
  featured: Type.Boolean(),
  body: EditorialBlockListSchema,
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
});

export const EditorialPlacementSlotParamSchema = Type.Union([
  Type.Literal("home_hero"),
  Type.Literal("home_whats_on"),
  Type.Literal("home_stories"),
  Type.Literal("home_guide"),
  Type.Literal("art_hub_spotlight"),
  Type.Literal("collector_hub_card"),
]);

export const EditorialIdParamsSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
});

export const EditorialCreateResponseSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
});
