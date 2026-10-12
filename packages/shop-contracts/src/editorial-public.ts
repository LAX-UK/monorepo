import { Type } from "@sinclair/typebox";
import { EditorialBlockListSchema } from "./editorial-blocks.js";

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

export const EditorialExhibitionSummarySchema = Type.Object({
  slug: Type.String(),
  kind: EditorialExhibitionKindSchema,
  title: Type.String(),
  summary: Type.Union([Type.String(), Type.Null()]),
  startsOn: Type.Union([Type.String(), Type.Null()]),
  endsOn: Type.Union([Type.String(), Type.Null()]),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
  featured: Type.Boolean(),
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
  timesNote: Type.Union([Type.String(), Type.Null()]),
  venueSlug: Type.Union([Type.String(), Type.Null()]),
  body: EditorialBlockListSchema,
  installationMedia: Type.Array(
    Type.Object({
      url: Type.String(),
      caption: Type.Union([Type.String(), Type.Null()]),
    }),
  ),
});

export const EditorialStorySummarySchema = Type.Object({
  slug: Type.String(),
  kind: EditorialStoryKindSchema,
  title: Type.String(),
  standfirst: Type.Union([Type.String(), Type.Null()]),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
  featured: Type.Boolean(),
});

export const EditorialStoryDetailSchema = Type.Object({
  slug: Type.String(),
  kind: EditorialStoryKindSchema,
  title: Type.String(),
  standfirst: Type.Union([Type.String(), Type.Null()]),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
  featured: Type.Boolean(),
  videoUrl: Type.Union([Type.String(), Type.Null()]),
  body: EditorialBlockListSchema,
});

export const EditorialPageDetailSchema = Type.Object({
  slug: Type.String(),
  title: Type.String(),
  body: EditorialBlockListSchema,
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
