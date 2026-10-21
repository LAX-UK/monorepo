import { Type } from "@sinclair/typebox";
import { PublicArtistDetailSchema, PublicArtistSummarySchema } from "./artist-public.js";
import { PublicArtworkSummarySchema } from "./artwork-public.js";
import { EditorialBlockListSchema } from "./editorial-blocks.js";
import { PublicSeoFieldsProperties } from "./seo-fields.js";

export const EditorialExhibitionStatusFilterSchema = Type.Union([
  Type.Literal("current"),
  Type.Literal("upcoming"),
  Type.Literal("past"),
]);

export const EditorialStoryKindSchema = Type.Union([
  Type.Literal("article"),
  Type.Literal("film"),
  Type.Literal("press"),
  Type.Literal("guide"),
]);

export const EditorialExhibitionKindSchema = Type.Union([
  Type.Literal("exhibition"),
  Type.Literal("film"),
  Type.Literal("event"),
]);

export const EditorialPlacementSlotSchema = Type.Union([
  Type.Literal("home_hero"),
  Type.Literal("home_whats_on"),
  Type.Literal("home_stories"),
  Type.Literal("home_guide"),
  Type.Literal("art_hub_spotlight"),
  Type.Literal("collector_hub_card"),
]);

export const EditorialHomePlacementSchema = Type.Object({
  slot: EditorialPlacementSlotSchema,
  position: Type.Integer({ minimum: 0 }),
  headline: Type.Union([Type.String(), Type.Null()]),
  mediaUrl: Type.Union([Type.String(), Type.Null()]),
  linkUrl: Type.Union([Type.String(), Type.Null()]),
  refKind: Type.String(),
  refSlug: Type.Union([Type.String(), Type.Null()]),
});

export const EditorialHomeResponseSchema = Type.Object({
  placements: Type.Array(EditorialHomePlacementSchema),
});

export const EditorialVenueSummarySchema = Type.Object({
  slug: Type.String(),
  name: Type.String(),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
});

export const EditorialVenueDetailSchema = Type.Object({
  slug: Type.String(),
  name: Type.String(),
  address: Type.Union([Type.String(), Type.Null()]),
  postcode: Type.Union([Type.String(), Type.Null()]),
  openingHours: Type.Union([Type.Unknown(), Type.Null()]),
  phone: Type.Union([Type.String(), Type.Null()]),
  email: Type.Union([Type.String(), Type.Null()]),
  mapUrl: Type.Union([Type.String(), Type.Null()]),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
  body: EditorialBlockListSchema,
});

/** Published venue an exhibition is held at; null when it has none or the venue is unpublished. */
export const EditorialExhibitionVenueSchema = Type.Object({
  slug: Type.String(),
  name: Type.String(),
});

// Fields added after launch are optional so storefronts parse responses from an older shop-api.
const NullableDateTime = Type.Union([Type.String({ format: "date-time" }), Type.Null()]);

export const EditorialExhibitionSummarySchema = Type.Object({
  slug: Type.String(),
  kind: EditorialExhibitionKindSchema,
  title: Type.String(),
  summary: Type.Union([Type.String(), Type.Null()]),
  startsOn: Type.Union([Type.String(), Type.Null()]),
  endsOn: Type.Union([Type.String(), Type.Null()]),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
  featured: Type.Boolean(),
  venue: Type.Optional(Type.Union([EditorialExhibitionVenueSchema, Type.Null()])),
});

export const EditorialStorySummarySchema = Type.Object({
  slug: Type.String(),
  kind: EditorialStoryKindSchema,
  title: Type.String(),
  standfirst: Type.Union([Type.String(), Type.Null()]),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
  featured: Type.Boolean(),
  publishedAt: Type.Optional(NullableDateTime),
  /** Sitemap `lastmod`; optional so storefronts parse responses from an older shop-api. */
  updatedAt: Type.Optional(Type.String({ format: "date-time" })),
});

export const EditorialExhibitionDetailSchema = Type.Object({
  slug: Type.String(),
  kind: EditorialExhibitionKindSchema,
  title: Type.String(),
  summary: Type.Union([Type.String(), Type.Null()]),
  startsOn: Type.Union([Type.String(), Type.Null()]),
  endsOn: Type.Union([Type.String(), Type.Null()]),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
  featured: Type.Boolean(),
  venue: Type.Optional(Type.Union([EditorialExhibitionVenueSchema, Type.Null()])),
  timesNote: Type.Union([Type.String(), Type.Null()]),
  venueSlug: Type.Union([Type.String(), Type.Null()]),
  body: EditorialBlockListSchema,
  installationMedia: Type.Array(
    Type.Object({
      url: Type.String(),
      caption: Type.Union([Type.String(), Type.Null()]),
    }),
  ),
  /** lax.art works in curated order. */
  artworks: Type.Optional(Type.Array(PublicArtworkSummarySchema)),
  /** Featured artists with biography, nationality and life dates. */
  artists: Type.Optional(Type.Array(PublicArtistDetailSchema)),
  stories: Type.Optional(Type.Array(EditorialStorySummarySchema)),
});

export const EditorialStoryRelatedSchema = Type.Object({
  artists: Type.Array(PublicArtistSummarySchema),
  artworks: Type.Array(PublicArtworkSummarySchema),
  exhibitions: Type.Array(EditorialExhibitionSummarySchema),
});

export const EditorialStoryDetailSchema = Type.Object({
  slug: Type.String(),
  kind: EditorialStoryKindSchema,
  title: Type.String(),
  standfirst: Type.Union([Type.String(), Type.Null()]),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
  featured: Type.Boolean(),
  publishedAt: Type.Optional(NullableDateTime),
  videoUrl: Type.Union([Type.String(), Type.Null()]),
  body: EditorialBlockListSchema,
  related: Type.Optional(EditorialStoryRelatedSchema),
  ...PublicSeoFieldsProperties,
});

/** Published exhibitions and stories that feature an artist (`/v1/editorial/artists/:slug`). */
export const EditorialArtistRelationsSchema = Type.Object({
  exhibitions: Type.Array(EditorialExhibitionSummarySchema),
  stories: Type.Array(EditorialStorySummarySchema),
});

export const EditorialPageSummarySchema = Type.Object({
  slug: Type.String(),
  title: Type.String(),
  updatedAt: Type.String({ format: "date-time" }),
});

export const EditorialPageDetailSchema = Type.Object({
  slug: Type.String(),
  title: Type.String(),
  body: EditorialBlockListSchema,
  ...PublicSeoFieldsProperties,
});

export const RegisterGeneralEnquiryRequestSchema = Type.Object({
  topic: Type.Union([
    Type.Literal("general"),
    Type.Literal("private_viewing"),
    Type.Literal("art_advisory"),
    Type.Literal("selling"),
    Type.Literal("exhibition"),
  ]),
  contextSlug: Type.Optional(Type.String({ maxLength: 120 })),
  message: Type.String({ minLength: 1, maxLength: 4000, pattern: "\\S" }),
  phone: Type.Optional(Type.String({ maxLength: 40 })),
});

export const GeneralEnquiryTopicSchema = Type.Union([
  Type.Literal("general"),
  Type.Literal("private_viewing"),
  Type.Literal("art_advisory"),
  Type.Literal("selling"),
  Type.Literal("exhibition"),
]);

export const GeneralEnquiryRowSchema = Type.Object({
  enquiryId: Type.String({ format: "uuid" }),
  topic: GeneralEnquiryTopicSchema,
  contextSlug: Type.Union([Type.String(), Type.Null()]),
  message: Type.String(),
  phone: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: "date-time" }),
});

export const PortalGeneralEnquiriesResponseSchema = Type.Object({
  items: Type.Array(GeneralEnquiryRowSchema),
});

export const AdminGeneralEnquiryRowSchema = Type.Object({
  enquiryId: Type.String({ format: "uuid" }),
  identitySubjectId: Type.String(),
  topic: GeneralEnquiryTopicSchema,
  contextSlug: Type.Union([Type.String(), Type.Null()]),
  message: Type.String(),
  phone: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: "date-time" }),
});

export const AdminGeneralEnquiriesResponseSchema = Type.Object({
  items: Type.Array(AdminGeneralEnquiryRowSchema),
});

export type EditorialHomeResponse = typeof EditorialHomeResponseSchema.static;
export type GeneralEnquiryRow = typeof GeneralEnquiryRowSchema.static;
export type AdminGeneralEnquiryRow = typeof AdminGeneralEnquiryRowSchema.static;
