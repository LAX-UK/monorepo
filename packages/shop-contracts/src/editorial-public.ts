import { Type } from "@sinclair/typebox";
import { PublicArtistDetailSchema, PublicArtistSummarySchema } from "./artist-public.js";
import { PublicArtworkSummarySchema } from "./artwork-public.js";
import { EditorialBlockListSchema } from "./editorial-blocks.js";
import {
  EditorialStoryCategorySchema,
  EditorialStoryKindSchema,
} from "./editorial-story-category.js";
import { EnquiryContactProperties } from "./enquiry-contact.js";
import { PublicSeoFieldsProperties } from "./seo-fields.js";

export const EditorialExhibitionStatusFilterSchema = Type.Union([
  Type.Literal("current"),
  Type.Literal("upcoming"),
  Type.Literal("past"),
]);

/** `/v1/editorial/stories` filters; all optional and combined with AND. */
export const EditorialStoryListQuerySchema = Type.Object({
  kind: Type.Optional(EditorialStoryKindSchema),
  category: Type.Optional(EditorialStoryCategorySchema),
  series: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
});

export type EditorialStoryListQuery = typeof EditorialStoryListQuerySchema.static;

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
  Type.Literal("home_promo_bid"),
  Type.Literal("home_promo_shop"),
  Type.Literal("art_hub_now_on"),
  Type.Literal("art_hub_podcast"),
  Type.Literal("art_hub_films"),
  Type.Literal("art_hub_press"),
  Type.Literal("art_hub_feature"),
]);

export type EditorialPlacementSlot = typeof EditorialPlacementSlotSchema.static;

// Fields added after launch are optional so storefronts parse responses from an older shop-api.
const NullableDateTime = Type.Union([Type.String({ format: "date-time" }), Type.Null()]);
const OptionalNullableString = Type.Optional(Type.Union([Type.String(), Type.Null()]));
const OptionalNullableInteger = Type.Optional(Type.Union([Type.Integer(), Type.Null()]));
const OptionalNullableNumber = Type.Optional(Type.Union([Type.Number(), Type.Null()]));

export const EditorialHomePlacementSchema = Type.Object({
  slot: EditorialPlacementSlotSchema,
  position: Type.Integer({ minimum: 0 }),
  headline: Type.Union([Type.String(), Type.Null()]),
  /** Supporting copy for promo bands and hub cards. */
  body: OptionalNullableString,
  ctaLabel: OptionalNullableString,
  mediaUrl: Type.Union([Type.String(), Type.Null()]),
  linkUrl: Type.Union([Type.String(), Type.Null()]),
  refKind: Type.String(),
  refSlug: Type.Union([Type.String(), Type.Null()]),
});

export const EditorialHomeResponseSchema = Type.Object({
  placements: Type.Array(EditorialHomePlacementSchema),
});

/** Card address: street and postcode sit on separate lines, then the city. */
const VenueCardAddressProperties = {
  streetLine: OptionalNullableString,
  postcode: OptionalNullableString,
  city: OptionalNullableString,
};

export const EditorialVenueSummarySchema = Type.Object({
  slug: Type.String(),
  name: Type.String(),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
  ...VenueCardAddressProperties,
});

export const EditorialVenueDetailSchema = Type.Object({
  slug: Type.String(),
  name: Type.String(),
  address: Type.Union([Type.String(), Type.Null()]),
  postcode: Type.Union([Type.String(), Type.Null()]),
  streetLine: OptionalNullableString,
  city: OptionalNullableString,
  latitude: OptionalNullableNumber,
  longitude: OptionalNullableNumber,
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
  ...VenueCardAddressProperties,
});

/** The gallery contact for an exhibition; omitted (null) when no contact name is set. */
export const EditorialExhibitionContactSchema = Type.Object({
  name: Type.String(),
  role: Type.Union([Type.String(), Type.Null()]),
  email: Type.Union([Type.String(), Type.Null()]),
  phone: Type.Union([Type.String(), Type.Null()]),
  avatarUrl: Type.Union([Type.String(), Type.Null()]),
});

export const EditorialExhibitionSummarySchema = Type.Object({
  slug: Type.String(),
  kind: EditorialExhibitionKindSchema,
  title: Type.String(),
  /** Short type line, e.g. "Selling exhibition". */
  subtitle: OptionalNullableString,
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
  /** Display category; derived from `kind` when the editor left it blank. */
  category: Type.Optional(EditorialStoryCategorySchema),
  authorName: OptionalNullableString,
  /** Editor's value, else estimated from the body; null when the body has no prose. */
  readMinutes: OptionalNullableInteger,
  series: OptionalNullableString,
  episodeNumber: OptionalNullableInteger,
  /** Running time of a film or podcast. */
  durationSeconds: OptionalNullableInteger,
  /** Press stories: the outlet and the original article. */
  publicationName: OptionalNullableString,
  externalUrl: OptionalNullableString,
  /** Sitemap `lastmod`; optional so storefronts parse responses from an older shop-api. */
  updatedAt: Type.Optional(Type.String({ format: "date-time" })),
});

export const EditorialExhibitionDetailSchema = Type.Object({
  slug: Type.String(),
  kind: EditorialExhibitionKindSchema,
  title: Type.String(),
  /** Short type line, e.g. "Selling exhibition". */
  subtitle: OptionalNullableString,
  summary: Type.Union([Type.String(), Type.Null()]),
  startsOn: Type.Union([Type.String(), Type.Null()]),
  endsOn: Type.Union([Type.String(), Type.Null()]),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
  featured: Type.Boolean(),
  venue: Type.Optional(Type.Union([EditorialExhibitionVenueSchema, Type.Null()])),
  timesNote: Type.Union([Type.String(), Type.Null()]),
  contact: Type.Optional(Type.Union([EditorialExhibitionContactSchema, Type.Null()])),
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
  /** Display category; derived from `kind` when the editor left it blank. */
  category: Type.Optional(EditorialStoryCategorySchema),
  authorName: OptionalNullableString,
  /** Editor's value, else estimated from the body; null when the body has no prose. */
  readMinutes: OptionalNullableInteger,
  series: OptionalNullableString,
  episodeNumber: OptionalNullableInteger,
  /** Running time of a film or podcast. */
  durationSeconds: OptionalNullableInteger,
  /** Press stories: the outlet and the original article. */
  publicationName: OptionalNullableString,
  externalUrl: OptionalNullableString,
  videoUrl: Type.Union([Type.String(), Type.Null()]),
  audioUrl: OptionalNullableString,
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
  ...EnquiryContactProperties,
});

/** A stored general enquiry and the reference its sender can quote ("E-2041"). */
export const GeneralEnquiryCreatedSchema = Type.Object({
  enquiryId: Type.String({ format: "uuid" }),
  reference: Type.Optional(Type.String({ pattern: "^E-[0-9]+$" })),
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

export type EditorialHomeResponse = typeof EditorialHomeResponseSchema.static;
export type GeneralEnquiryRow = typeof GeneralEnquiryRowSchema.static;
