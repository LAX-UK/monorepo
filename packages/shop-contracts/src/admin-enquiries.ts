import { type Static, Type } from "@sinclair/typebox";

/** `general` rows come from shop_general_enquiry, `artwork` rows from shop_artwork_interest. */
export const ENQUIRY_KINDS = ["general", "artwork"] as const;
export const EnquiryKindSchema = Type.Union(ENQUIRY_KINDS.map((kind) => Type.Literal(kind)));
export type EnquiryKind = (typeof ENQUIRY_KINDS)[number];

export const ENQUIRY_STATUSES = ["new", "in_progress", "closed"] as const;
export const EnquiryStatusSchema = Type.Union(ENQUIRY_STATUSES.map((s) => Type.Literal(s)));
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

/** The general topics, plus `artwork` for enquiries made from an artwork page. */
export const ENQUIRY_TOPICS = [
  "general",
  "private_viewing",
  "art_advisory",
  "selling",
  "exhibition",
  "order_problem",
  "artwork",
] as const;
export const EnquiryTopicSchema = Type.Union(ENQUIRY_TOPICS.map((topic) => Type.Literal(topic)));
export type EnquiryTopic = (typeof ENQUIRY_TOPICS)[number];

export const ENQUIRY_NOTE_MAX_LENGTH = 5000;
export const ENQUIRY_SEARCH_MAX_LENGTH = 100;
export const ENQUIRY_LIST_DEFAULT_LIMIT = 50;
export const ENQUIRY_LIST_MAX_LIMIT = 50;

/**
 * Waiting enquiries (`new`) always come first. Within each group, newest received first or
 * oldest received first.
 */
export const ENQUIRY_LIST_SORTS = ["received_desc", "received_asc"] as const;
export const EnquiryListSortSchema = Type.Union(
  ENQUIRY_LIST_SORTS.map((sort) => Type.Literal(sort)),
);
export type EnquiryListSort = (typeof ENQUIRY_LIST_SORTS)[number];

const NullableString = Type.Union([Type.String(), Type.Null()]);

/**
 * Opaque token for one enquiry's triage state (status and assignee). Send it back as
 * `expectedVersion`; a mismatch means another member of staff changed it first.
 */
const EnquiryVersionSchema = Type.String({ minLength: 1, maxLength: 64 });

export const EnquiryAssigneeSchema = Type.Object({
  subject: Type.String(),
  /** Name or email when the staff member has a profile; null otherwise. */
  label: NullableString,
  /** Their staff role, so a person without a profile can still be told apart. */
  role: NullableString,
});
export type EnquiryAssignee = Static<typeof EnquiryAssigneeSchema>;

/** A guest has only what they typed; a member is also linked to their account. */
export const EnquirySenderSchema = Type.Object({
  type: Type.Union([Type.Literal("guest"), Type.Literal("member")]),
  name: NullableString,
  email: NullableString,
});
export type EnquirySender = Static<typeof EnquirySenderSchema>;

export const EnquiryArtworkSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  title: Type.String(),
  slug: Type.String(),
  thumbnailUrl: NullableString,
});
export type EnquiryArtwork = Static<typeof EnquiryArtworkSchema>;

/** `assignee` is `me`, `unassigned` or a staff identity subject. */
export const AdminEnquiryListQuerySchema = Type.Object({
  kind: Type.Optional(EnquiryKindSchema),
  topic: Type.Optional(EnquiryTopicSchema),
  status: Type.Optional(EnquiryStatusSchema),
  assignee: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  q: Type.Optional(Type.String({ maxLength: ENQUIRY_SEARCH_MAX_LENGTH })),
  sort: Type.Optional(EnquiryListSortSchema),
  cursor: Type.Optional(Type.String({ maxLength: 512 })),
  limit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: ENQUIRY_LIST_MAX_LIMIT,
      default: ENQUIRY_LIST_DEFAULT_LIMIT,
    }),
  ),
});
export type AdminEnquiryListQuery = Static<typeof AdminEnquiryListQuerySchema>;

export const AdminEnquiryListItemSchema = Type.Object({
  kind: EnquiryKindSchema,
  id: Type.String({ format: "uuid" }),
  topic: EnquiryTopicSchema,
  status: EnquiryStatusSchema,
  assignee: Type.Union([EnquiryAssigneeSchema, Type.Null()]),
  sender: EnquirySenderSchema,
  artwork: Type.Union([EnquiryArtworkSchema, Type.Null()]),
  excerpt: Type.String(),
  /** Send back as `expectedVersion` when changing status or assignee. */
  version: EnquiryVersionSchema,
  createdAt: Type.String({ format: "date-time" }),
});
export type AdminEnquiryListItem = Static<typeof AdminEnquiryListItemSchema>;

export const AdminEnquiryListResponseSchema = Type.Object({
  items: Type.Array(AdminEnquiryListItemSchema),
  nextCursor: NullableString,
  /** Matches per status under every active filter except `status`, so the chips add up. */
  counts: Type.Object({
    new: Type.Integer(),
    in_progress: Type.Integer(),
    closed: Type.Integer(),
  }),
});
export type AdminEnquiryListResponse = Static<typeof AdminEnquiryListResponseSchema>;

export const AdminEnquiryNoteSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  author: EnquiryAssigneeSchema,
  body: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
});
export type AdminEnquiryNote = Static<typeof AdminEnquiryNoteSchema>;

export const AdminEnquiryDetailSchema = Type.Object({
  kind: EnquiryKindSchema,
  id: Type.String({ format: "uuid" }),
  topic: EnquiryTopicSchema,
  status: EnquiryStatusSchema,
  assignee: Type.Union([EnquiryAssigneeSchema, Type.Null()]),
  sender: Type.Composite([EnquirySenderSchema, Type.Object({ phone: NullableString })]),
  artwork: Type.Union([EnquiryArtworkSchema, Type.Null()]),
  /** Slug of the exhibition, artist or venue page the enquiry was sent from. */
  contextSlug: NullableString,
  message: Type.String(),
  notes: Type.Array(AdminEnquiryNoteSchema),
  createdAt: Type.String({ format: "date-time" }),
  closedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  version: EnquiryVersionSchema,
});
export type AdminEnquiryDetail = Static<typeof AdminEnquiryDetailSchema>;

export const AdminEnquiryParamsSchema = Type.Object({
  kind: EnquiryKindSchema,
  id: Type.String({ format: "uuid" }),
});

export const AdminEnquiryUpdateBodySchema = Type.Object(
  {
    status: Type.Optional(EnquiryStatusSchema),
    /** A staff identity subject, or null to unassign. Omit to leave the assignee alone. */
    assigneeSubject: Type.Optional(
      Type.Union([Type.String({ minLength: 1, maxLength: 200 }), Type.Null()]),
    ),
    expectedVersion: EnquiryVersionSchema,
  },
  { additionalProperties: false },
);
export type AdminEnquiryUpdateBody = Static<typeof AdminEnquiryUpdateBodySchema>;

export const AdminEnquiryUpdateResponseSchema = Type.Object({ version: EnquiryVersionSchema });
export type AdminEnquiryUpdateResponse = Static<typeof AdminEnquiryUpdateResponseSchema>;

/** 409: the enquiry changed since `expectedVersion`; nothing was written. */
export const AdminEnquiryConflictBodySchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
  requestId: Type.Optional(Type.String()),
  currentVersion: EnquiryVersionSchema,
});
export type AdminEnquiryConflictBody = Static<typeof AdminEnquiryConflictBodySchema>;

export const AdminEnquiryNoteBodySchema = Type.Object(
  { body: Type.String({ minLength: 1, maxLength: ENQUIRY_NOTE_MAX_LENGTH }) },
  { additionalProperties: false },
);
export type AdminEnquiryNoteBody = Static<typeof AdminEnquiryNoteBodySchema>;

/** Counts behind the navigation badge and the overview tile. */
export const AdminEnquirySummarySchema = Type.Object({
  newCount: Type.Integer(),
  /** New and not yet assigned: the enquiries nobody has picked up. */
  needsAttentionCount: Type.Integer(),
});
export type AdminEnquirySummary = Static<typeof AdminEnquirySummarySchema>;

/** Active staff who can act on enquiries, for the assignee picker. */
export const AdminEnquiryAssigneesResponseSchema = Type.Object({
  items: Type.Array(EnquiryAssigneeSchema),
});
export type AdminEnquiryAssigneesResponse = Static<typeof AdminEnquiryAssigneesResponseSchema>;
