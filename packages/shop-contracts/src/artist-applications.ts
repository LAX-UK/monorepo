import "./contract-formats.js";
import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { EnquiryAssigneeSchema } from "./admin-enquiries.js";
import { ShopContractParseError } from "./parse-public.js";

/*
 * Artists' applications to join the gallery: the applicant's own routes (`/v1/me/artist-
 * application…`, reached from lax.art and LAX Account) and the staff routes in LAX Admin.
 * The statuses and their transitions are owned by `@auction/shop-domain`; these lists mirror it
 * for clients that do not depend on the domain package, and shop-api tests that they agree.
 */

export const ARTIST_APPLICATION_STATUS_VALUES = [
  "draft",
  "submitted",
  "in_review",
  "more_info_needed",
  "accepted",
  "declined",
] as const;
export const ArtistApplicationStatusSchema = Type.Union(
  ARTIST_APPLICATION_STATUS_VALUES.map((status) => Type.Literal(status)),
);
export type ArtistApplicationStatusValue = (typeof ARTIST_APPLICATION_STATUS_VALUES)[number];

export const ARTIST_APPLICATION_WORK_KIND_VALUES = ["original", "edition"] as const;
export const ArtistApplicationWorkKindSchema = Type.Union(
  ARTIST_APPLICATION_WORK_KIND_VALUES.map((kind) => Type.Literal(kind)),
);

export const ARTIST_APPLICATION_STEP_VALUES = ["about", "work", "statement", "agreement"] as const;
export const ArtistApplicationStepSchema = Type.Union(
  ARTIST_APPLICATION_STEP_VALUES.map((step) => Type.Literal(step)),
);
export type ArtistApplicationStepValue = (typeof ARTIST_APPLICATION_STEP_VALUES)[number];

/** Upload limits the form shows; the API enforces them. */
export const ARTIST_APPLICATION_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const ARTIST_APPLICATION_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const NullableString = Type.Union([Type.String(), Type.Null()]);
const NullableDateTime = Type.Union([Type.String({ format: "date-time" }), Type.Null()]);
const Version = Type.Integer({ minimum: 1 });

export const ArtistApplicationWorkSchema = Type.Object({
  mediaKey: Type.String(),
  imageUrl: NullableString,
  width: Type.Union([Type.Integer(), Type.Null()]),
  height: Type.Union([Type.Integer(), Type.Null()]),
  title: NullableString,
  year: Type.Union([Type.Integer(), Type.Null()]),
  medium: NullableString,
  size: NullableString,
  kind: Type.Union([ArtistApplicationWorkKindSchema, Type.Null()]),
});
export type ArtistApplicationWorkView = Static<typeof ArtistApplicationWorkSchema>;

export const ArtistApplicationBlockerSchema = Type.Object({
  step: ArtistApplicationStepSchema,
  field: Type.String(),
  message: Type.String(),
});
export type ArtistApplicationBlockerView = Static<typeof ArtistApplicationBlockerSchema>;

/** The applicant's own view of their application. */
export const MyArtistApplicationSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  reference: Type.String(),
  status: ArtistApplicationStatusSchema,
  artistName: NullableString,
  location: NullableString,
  website: NullableString,
  socialLinks: Type.Array(Type.String()),
  shortBio: NullableString,
  statement: NullableString,
  representation: NullableString,
  exhibitions: NullableString,
  consentToContact: Type.Boolean(),
  works: Type.Array(ArtistApplicationWorkSchema),
  /** The question from the gallery, or the reason for a decline. */
  messageToArtist: NullableString,
  /** True while the applicant may change it: a draft, or while the gallery waits on them. */
  editable: Type.Boolean(),
  /** What still stops it being sent; empty when it can be sent. */
  blockers: Type.Array(ArtistApplicationBlockerSchema),
  submittedAt: NullableDateTime,
  decidedAt: NullableDateTime,
  updatedAt: Type.String({ format: "date-time" }),
  version: Version,
});
export type MyArtistApplication = Static<typeof MyArtistApplicationSchema>;

/**
 * The applicant's state: their latest application (any status) and what they may do next.
 * `start`: begin a new application; `continue`: carry on with the open one; `wait`: declined
 * recently, a new one opens on `availableFrom`; `accepted`: they are a gallery artist already.
 */
export const MyArtistApplicationStateSchema = Type.Object({
  application: Type.Union([MyArtistApplicationSchema, Type.Null()]),
  next: Type.Union([
    Type.Literal("start"),
    Type.Literal("continue"),
    Type.Literal("wait"),
    Type.Literal("accepted"),
  ]),
  availableFrom: NullableDateTime,
});
export type MyArtistApplicationState = Static<typeof MyArtistApplicationStateSchema>;

const WorkBodySchema = Type.Object({
  mediaKey: Type.String({ minLength: 1, maxLength: 512 }),
  title: Type.Union([Type.String({ maxLength: 160 }), Type.Null()]),
  year: Type.Union([Type.Integer({ minimum: 0, maximum: 9999 }), Type.Null()]),
  medium: Type.Union([Type.String({ maxLength: 160 }), Type.Null()]),
  size: Type.Union([Type.String({ maxLength: 80 }), Type.Null()]),
  kind: Type.Union([ArtistApplicationWorkKindSchema, Type.Null()]),
});

/**
 * Saves the draft. Every field is sent each time; `works` lists the images already uploaded to
 * this application in the order to keep them, so leaving one out removes it.
 */
export const SaveArtistApplicationBodySchema = Type.Object({
  expectedVersion: Version,
  artistName: Type.Union([Type.String({ maxLength: 120 }), Type.Null()]),
  location: Type.Union([Type.String({ maxLength: 120 }), Type.Null()]),
  website: Type.Union([Type.String({ maxLength: 300 }), Type.Null()]),
  socialLinks: Type.Array(Type.String({ maxLength: 300 }), { maxItems: 4 }),
  shortBio: Type.Union([Type.String({ maxLength: 1200 }), Type.Null()]),
  statement: Type.Union([Type.String({ maxLength: 4000 }), Type.Null()]),
  representation: Type.Union([Type.String({ maxLength: 1000 }), Type.Null()]),
  exhibitions: Type.Union([Type.String({ maxLength: 2000 }), Type.Null()]),
  consentToContact: Type.Boolean(),
  works: Type.Array(WorkBodySchema, { maxItems: 12 }),
});
export type SaveArtistApplicationBody = Static<typeof SaveArtistApplicationBodySchema>;

export const SubmitArtistApplicationBodySchema = Type.Object({ expectedVersion: Version });
export type SubmitArtistApplicationBody = Static<typeof SubmitArtistApplicationBodySchema>;

/** A refused submit lists what is missing, step by step. */
export const ArtistApplicationIncompleteBodySchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
  requestId: Type.Optional(Type.String()),
  /** Present when the refusal is missing answers rather than a malformed request. */
  blockers: Type.Optional(Type.Array(ArtistApplicationBlockerSchema)),
});

export const ArtistApplicationPresignBodySchema = Type.Object({
  contentType: Type.String({ minLength: 3, maxLength: 100 }),
  byteSize: Type.Integer({ minimum: 1 }),
});
export type ArtistApplicationPresignBody = Static<typeof ArtistApplicationPresignBodySchema>;

export const ArtistApplicationPresignResponseSchema = Type.Object({
  key: Type.String(),
  uploadUrl: Type.String(),
  requiredHeaders: Type.Record(Type.String(), Type.String()),
});
export type ArtistApplicationPresignResponse = Static<
  typeof ArtistApplicationPresignResponseSchema
>;

export const ArtistApplicationConfirmBodySchema = Type.Object({
  key: Type.String({ minLength: 1, maxLength: 512 }),
});
export type ArtistApplicationConfirmBody = Static<typeof ArtistApplicationConfirmBodySchema>;

export function parseMyArtistApplicationState(value: unknown): MyArtistApplicationState {
  if (!Value.Check(MyArtistApplicationStateSchema, value)) {
    throw new ShopContractParseError("Invalid artist application state payload");
  }
  return value;
}

export function parseMyArtistApplication(value: unknown): MyArtistApplication {
  if (!Value.Check(MyArtistApplicationSchema, value)) {
    throw new ShopContractParseError("Invalid artist application payload");
  }
  return value;
}

export function parseArtistApplicationPresign(value: unknown): ArtistApplicationPresignResponse {
  if (!Value.Check(ArtistApplicationPresignResponseSchema, value)) {
    throw new ShopContractParseError("Invalid artist application upload payload");
  }
  return value;
}

/** The blockers from a refused submit, or null when the body is something else. */
export function parseArtistApplicationBlockers(
  value: unknown,
): ArtistApplicationBlockerView[] | null {
  if (!Value.Check(ArtistApplicationIncompleteBodySchema, value)) return null;
  return value.blockers ?? null;
}

// ---------------------------------------------------------------------------------------------
// LAX Admin
// ---------------------------------------------------------------------------------------------

export const ArtistApplicationReviewerSchema = EnquiryAssigneeSchema;
export type ArtistApplicationReviewer = Static<typeof ArtistApplicationReviewerSchema>;

/** Built-in views of the queue: new, in review, waiting on the artist, decided, everything sent. */
export const ARTIST_APPLICATION_QUEUE_VIEWS = [
  "all",
  "new",
  "in_review",
  "waiting",
  "decided",
] as const;
export const ArtistApplicationQueueViewSchema = Type.Union(
  ARTIST_APPLICATION_QUEUE_VIEWS.map((view) => Type.Literal(view)),
);
export type ArtistApplicationQueueView = (typeof ARTIST_APPLICATION_QUEUE_VIEWS)[number];

export const ARTIST_APPLICATION_SEARCH_MAX_LENGTH = 100;
export const ARTIST_APPLICATION_LIST_MAX_LIMIT = 50;
export const ARTIST_APPLICATION_LIST_SORTS = ["submitted_desc", "submitted_asc"] as const;

export const AdminArtistApplicationListQuerySchema = Type.Object({
  view: Type.Optional(ArtistApplicationQueueViewSchema),
  /** `me`, `unassigned` or a staff identity subject. */
  assignee: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  q: Type.Optional(Type.String({ maxLength: ARTIST_APPLICATION_SEARCH_MAX_LENGTH })),
  sort: Type.Optional(Type.Union(ARTIST_APPLICATION_LIST_SORTS.map((sort) => Type.Literal(sort)))),
  cursor: Type.Optional(Type.String({ maxLength: 512 })),
  limit: Type.Optional(
    Type.Integer({ minimum: 1, maximum: ARTIST_APPLICATION_LIST_MAX_LIMIT, default: 50 }),
  ),
});
export type AdminArtistApplicationListQuery = Static<typeof AdminArtistApplicationListQuerySchema>;

const ApplicantSchema = Type.Object({
  /** The account's name, when the profile has one. */
  name: NullableString,
  email: NullableString,
});

export const AdminArtistApplicationListItemSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  reference: Type.String(),
  status: ArtistApplicationStatusSchema,
  artistName: NullableString,
  location: NullableString,
  applicant: ApplicantSchema,
  assignee: Type.Union([ArtistApplicationReviewerSchema, Type.Null()]),
  workCount: Type.Integer({ minimum: 0 }),
  coverImageUrl: NullableString,
  submittedAt: Type.String({ format: "date-time" }),
  version: Version,
});
export type AdminArtistApplicationListItem = Static<typeof AdminArtistApplicationListItemSchema>;

export const AdminArtistApplicationListResponseSchema = Type.Object({
  items: Type.Array(AdminArtistApplicationListItemSchema),
  nextCursor: NullableString,
  /** Matches per view under every filter except the view, so the view chips add up. */
  counts: Type.Object({
    all: Type.Integer(),
    new: Type.Integer(),
    in_review: Type.Integer(),
    waiting: Type.Integer(),
    decided: Type.Integer(),
  }),
});
export type AdminArtistApplicationListResponse = Static<
  typeof AdminArtistApplicationListResponseSchema
>;

export const AdminArtistApplicationEventSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  action: Type.String(),
  /** Who acted: the applicant, or a member of staff. */
  actor: Type.Object({
    kind: Type.Union([Type.Literal("applicant"), Type.Literal("staff")]),
    person: Type.Union([ArtistApplicationReviewerSchema, Type.Null()]),
  }),
  message: NullableString,
  assignee: Type.Union([ArtistApplicationReviewerSchema, Type.Null()]),
  createdAt: Type.String({ format: "date-time" }),
});
export type AdminArtistApplicationEvent = Static<typeof AdminArtistApplicationEventSchema>;

export const AdminArtistApplicationDetailSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  reference: Type.String(),
  status: ArtistApplicationStatusSchema,
  applicant: Type.Composite([ApplicantSchema, Type.Object({ subject: Type.String() })]),
  assignee: Type.Union([ArtistApplicationReviewerSchema, Type.Null()]),
  artistName: NullableString,
  location: NullableString,
  website: NullableString,
  socialLinks: Type.Array(Type.String()),
  shortBio: NullableString,
  statement: NullableString,
  representation: NullableString,
  exhibitions: NullableString,
  works: Type.Array(ArtistApplicationWorkSchema),
  messageToArtist: NullableString,
  /** The artist profile made on acceptance. */
  artist: Type.Union([
    Type.Object({ id: Type.String({ format: "uuid" }), slug: Type.String() }),
    Type.Null(),
  ]),
  events: Type.Array(AdminArtistApplicationEventSchema),
  /** When a declined artist may apply again. */
  reapplyFrom: NullableDateTime,
  submittedAt: Type.String({ format: "date-time" }),
  decidedAt: NullableDateTime,
  version: Version,
});
export type AdminArtistApplicationDetail = Static<typeof AdminArtistApplicationDetailSchema>;

export const AdminArtistApplicationReviewersResponseSchema = Type.Object({
  items: Type.Array(ArtistApplicationReviewerSchema),
});
export type AdminArtistApplicationReviewersResponse = Static<
  typeof AdminArtistApplicationReviewersResponseSchema
>;

export const AdminArtistApplicationAssignBodySchema = Type.Object({
  expectedVersion: Version,
  /** Null removes the reviewer. */
  assigneeSubject: Type.Union([Type.String({ minLength: 1, maxLength: 200 }), Type.Null()]),
});
export type AdminArtistApplicationAssignBody = Static<
  typeof AdminArtistApplicationAssignBodySchema
>;

export const AdminArtistApplicationMessageBodySchema = Type.Object({
  expectedVersion: Version,
  /** Sent to the artist: the question, or the reason for declining. */
  message: Type.String({ minLength: 1, maxLength: 2000 }),
});
export type AdminArtistApplicationMessageBody = Static<
  typeof AdminArtistApplicationMessageBodySchema
>;

export const AdminArtistApplicationAcceptBodySchema = Type.Object({
  expectedVersion: Version,
  /** The new profile's address on lax.art: lower case words joined by hyphens. */
  artistSlug: Type.String({ minLength: 1, maxLength: 120, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
  /** Also create each work as a draft artwork on the new profile. */
  importWorksAsDrafts: Type.Boolean(),
});
export type AdminArtistApplicationAcceptBody = Static<
  typeof AdminArtistApplicationAcceptBodySchema
>;

export const AdminArtistApplicationActionResponseSchema = Type.Object({
  status: ArtistApplicationStatusSchema,
  version: Version,
  /** Set by acceptance. */
  artistId: Type.Optional(Type.String({ format: "uuid" })),
  importedArtworkCount: Type.Optional(Type.Integer({ minimum: 0 })),
});
export type AdminArtistApplicationActionResponse = Static<
  typeof AdminArtistApplicationActionResponseSchema
>;

/**
 * A refused change. `currentVersion` is set when the copy was stale (someone else changed the
 * application first); without it, the transition table refused the action in this status.
 */
export const AdminArtistApplicationConflictBodySchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
  requestId: Type.Optional(Type.String()),
  currentVersion: Type.Optional(Type.String()),
});
