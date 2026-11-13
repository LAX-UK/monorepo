import { type Static, Type } from "@sinclair/typebox";

/**
 * The picture staff choose to lead the Shop home's first screen. The public read is what the
 * storefront builds the cover from (the same shape the lax.bid cover slots use, so one shared
 * adapter reads both); with no picture chosen it is `null` and the home leads as it always has.
 * The admin read adds what staff need to review the choice: the stored picture, its alt text, how
 * it was measured, and whether the type can sit on it.
 */

const UnitPointSchema = Type.Object({
  x: Type.Number({ minimum: 0, maximum: 1 }),
  y: Type.Number({ minimum: 0, maximum: 1 }),
});

const ScrimSettingSchema = Type.Object({
  tone: Type.Union([Type.Literal("light"), Type.Literal("dark")]),
  strength: Type.Number(),
  creditBand: Type.Number(),
});

export const PublicHomeCoverPictureSchema = Type.Object({
  src: Type.String({ minLength: 1 }),
  width: Type.Integer({ minimum: 1 }),
  height: Type.Integer({ minimum: 1 }),
  blurDataURL: Type.Optional(Type.String()),
  focal: UnitPointSchema,
  zoom: Type.Number({ minimum: 1 }),
  alt: Type.String({ minLength: 1 }),
  side: Type.Union([Type.Literal("left"), Type.Literal("right")]),
  analysisStatus: Type.Literal("ready"),
  colours: Type.Object({
    dominant: Type.String(),
    deepest: Type.String(),
    field: Type.String(),
  }),
  scrim: Type.Object({
    desktop: Type.Union([ScrimSettingSchema, Type.Null()]),
    wide: Type.Union([ScrimSettingSchema, Type.Null()]),
  }),
});
export type PublicHomeCoverPicture = Static<typeof PublicHomeCoverPictureSchema>;

export const PublicHomeCoverSchema = Type.Object({
  cover: Type.Union([PublicHomeCoverPictureSchema, Type.Null()]),
});
export type PublicHomeCover = Static<typeof PublicHomeCoverSchema>;

/** The longest alt text; the same bound the media library keeps. */
export const HOME_COVER_ALT_MAX_LENGTH = 500;

export const AdminHomeCoverSchema = Type.Object({
  cover: Type.Union([
    Type.Object({
      mediaKey: Type.String(),
      imageUrl: Type.String(),
      width: Type.Integer({ minimum: 1 }),
      height: Type.Integer({ minimum: 1 }),
      alt: Type.String(),
      focal: UnitPointSchema,
      /** Which way the type sits: away from the subject. */
      side: Type.Union([Type.Literal("left"), Type.Literal("right")]),
      /** The colour of the type that was measured to read on the picture. */
      tone: Type.Union([Type.Literal("light"), Type.Literal("dark")]),
      updatedAt: Type.String({ format: "date-time" }),
    }),
    Type.Null(),
  ]),
  /** The narrowest picture that is accepted, so the form can say so before a save. */
  minimumWidth: Type.Integer({ minimum: 1 }),
});
export type AdminHomeCover = Static<typeof AdminHomeCoverSchema>;

export const AdminHomeCoverSaveBodySchema = Type.Object({
  mediaKey: Type.String({ minLength: 1, maxLength: 512 }),
  alt: Type.String({ maxLength: HOME_COVER_ALT_MAX_LENGTH }),
  focal: UnitPointSchema,
});
export type AdminHomeCoverSaveBody = Static<typeof AdminHomeCoverSaveBodySchema>;

/** The fields a refused save can name. */
export const HOME_COVER_ISSUE_FIELD_VALUES = ["mediaKey", "alt"] as const;
export type HomeCoverIssueField = (typeof HOME_COVER_ISSUE_FIELD_VALUES)[number];

export const HOME_COVER_ISSUE_REASON_VALUES = [
  "picture_unknown",
  "picture_unreadable",
  "picture_too_narrow",
  "picture_cannot_carry_type",
  "alt_missing",
] as const;
export type HomeCoverIssueReason = (typeof HOME_COVER_ISSUE_REASON_VALUES)[number];

export const AdminHomeCoverIssueSchema = Type.Object({
  field: Type.Union(HOME_COVER_ISSUE_FIELD_VALUES.map((field) => Type.Literal(field))),
  reason: Type.Union(HOME_COVER_ISSUE_REASON_VALUES.map((reason) => Type.Literal(reason))),
});
export type AdminHomeCoverIssue = Static<typeof AdminHomeCoverIssueSchema>;

export const AdminHomeCoverRejectedBodySchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
  requestId: Type.Optional(Type.String()),
  /** Absent when the request itself was malformed. */
  issues: Type.Optional(Type.Array(AdminHomeCoverIssueSchema)),
});
export type AdminHomeCoverRejectedBody = Static<typeof AdminHomeCoverRejectedBodySchema>;

/** A picture of a live Shop edition that staff can use as the cover. */
export const AdminHomeCoverPictureCandidateSchema = Type.Object({
  mediaKey: Type.String(),
  imageUrl: Type.String(),
  artworkTitle: Type.String(),
  artistName: Type.String(),
});
export type AdminHomeCoverPictureCandidate = Static<typeof AdminHomeCoverPictureCandidateSchema>;

export const AdminHomeCoverPictureCandidatesSchema = Type.Object({
  items: Type.Array(AdminHomeCoverPictureCandidateSchema),
});
export type AdminHomeCoverPictureCandidates = Static<typeof AdminHomeCoverPictureCandidatesSchema>;
