import { type Static, Type } from "@sinclair/typebox";

/**
 * "Link lax.art": originals that were put on lax.art before the artwork register are matched to
 * their register records so the one-place lock and the moves protect them. Matching only reads;
 * linking happens when staff confirm, one artwork at a time or Matched rows in bulk.
 */

const Nullable = <T extends ReturnType<typeof Type.String> | ReturnType<typeof Type.Integer>>(
  schema: T,
) => Type.Union([schema, Type.Null()]);

/** The lax.art original that is not linked yet. */
export const AdminZohoLinkListingSchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  slug: Type.String(),
  title: Type.String(),
  artistName: Type.String(),
  /** The Zoho artist code the listing's artist carries; null when the artist has none. */
  artistCode: Nullable(Type.String()),
  stockCode: Nullable(Type.String()),
  dimensions: Nullable(Type.String()),
  year: Nullable(Type.Integer()),
  published: Type.Boolean(),
});
export type AdminZohoLinkListing = Static<typeof AdminZohoLinkListingSchema>;

/** A register record the listing could be linked to. */
export const AdminZohoLinkRecordSchema = Type.Object({
  registerId: Type.String({ format: "uuid" }),
  stockCode: Type.String(),
  title: Type.String(),
  artistName: Type.String(),
  artistCode: Type.String(),
  dimensions: Nullable(Type.String()),
  year: Nullable(Type.Integer()),
  /** Zoho's Status for the record, for example Available. */
  zohoStatus: Nullable(Type.String()),
  /** Where the artwork is offered now, in words for staff (for example "Not offered"). */
  whereItIs: Type.String(),
});
export type AdminZohoLinkRecord = Static<typeof AdminZohoLinkRecordSchema>;

export const ADMIN_ZOHO_LINK_FIELDS = [
  "title",
  "artist",
  "medium",
  "size",
  "year",
  "images",
] as const;
export const AdminZohoLinkFieldSchema = Type.Union(
  ADMIN_ZOHO_LINK_FIELDS.map((field) => Type.Literal(field)),
);
export type AdminZohoLinkField = Static<typeof AdminZohoLinkFieldSchema>;

/**
 * One thing that differs: Zoho's value replaces lax.art's when the link is made. Values are shown
 * as text; null means that side has none.
 */
export const AdminZohoLinkDifferenceSchema = Type.Object({
  field: AdminZohoLinkFieldSchema,
  label: Type.String(),
  zohoValue: Nullable(Type.String()),
  laxArtValue: Nullable(Type.String()),
});
export type AdminZohoLinkDifference = Static<typeof AdminZohoLinkDifferenceSchema>;

export const AdminZohoLinkRuleSchema = Type.Union([
  Type.Literal("stock_code"),
  Type.Literal("artist_and_title"),
  Type.Literal("artist_title_and_size"),
  Type.Literal("artist_title_and_year"),
]);

export const AdminZohoLinkNoMatchReasonSchema = Type.Union([
  Type.Literal("stock_code_unknown"),
  Type.Literal("artist_has_no_zoho_code"),
  Type.Literal("no_record_for_artist_and_title"),
]);

export const AdminZohoLinkCandidateSchema = Type.Object({
  record: AdminZohoLinkRecordSchema,
  differences: Type.Array(AdminZohoLinkDifferenceSchema),
  /** Why this record cannot be linked now (held elsewhere, sold, reserved), or null. */
  refusal: Nullable(Type.String()),
});
export type AdminZohoLinkCandidate = Static<typeof AdminZohoLinkCandidateSchema>;

export const AdminZohoLinkRowSchema = Type.Object({
  listing: AdminZohoLinkListingSchema,
  /** Matched: the one record. Needs a choice: the records to choose from. No match: empty. */
  candidates: Type.Array(AdminZohoLinkCandidateSchema),
  rule: Type.Union([AdminZohoLinkRuleSchema, Type.Null()]),
  reason: Type.Union([AdminZohoLinkNoMatchReasonSchema, Type.Null()]),
});
export type AdminZohoLinkRow = Static<typeof AdminZohoLinkRowSchema>;

export const AdminZohoLinkReportSchema = Type.Object({
  /** When the matching ran. Matching only reads; "Check again" runs it again. */
  checkedAt: Type.String({ format: "date-time" }),
  counts: Type.Object({
    unlinked: Type.Integer({ minimum: 0 }),
    matched: Type.Integer({ minimum: 0 }),
    needsChoice: Type.Integer({ minimum: 0 }),
    noMatch: Type.Integer({ minimum: 0 }),
  }),
  matched: Type.Array(AdminZohoLinkRowSchema),
  needsChoice: Type.Array(AdminZohoLinkRowSchema),
  noMatch: Type.Array(AdminZohoLinkRowSchema),
  /** The switch that stops publishing an original that is not linked. */
  blockUnlinkedPublish: Type.Boolean(),
});
export type AdminZohoLinkReport = Static<typeof AdminZohoLinkReportSchema>;

/** Just the number of unlinked originals: enough to show or hide the tab. */
export const AdminZohoLinkCountSchema = Type.Object({
  unlinked: Type.Integer({ minimum: 0 }),
});
export type AdminZohoLinkCount = Static<typeof AdminZohoLinkCountSchema>;

export const AdminZohoLinkPreviewQuerySchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  registerId: Type.String({ format: "uuid" }),
});

export const AdminZohoLinkPreviewSchema = Type.Object({
  listing: AdminZohoLinkListingSchema,
  candidate: AdminZohoLinkCandidateSchema,
});
export type AdminZohoLinkPreview = Static<typeof AdminZohoLinkPreviewSchema>;

export const AdminZohoLinkSearchQuerySchema = Type.Object({
  q: Type.String({ minLength: 2, maxLength: 100 }),
});

export const AdminZohoLinkSearchResultSchema = Type.Object({
  items: Type.Array(AdminZohoLinkRecordSchema),
  /** True when more records match than are listed: staff narrow the search. */
  more: Type.Boolean(),
});
export type AdminZohoLinkSearchResult = Static<typeof AdminZohoLinkSearchResultSchema>;

export const AdminZohoLinkBodySchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  registerId: Type.String({ format: "uuid" }),
});
export type AdminZohoLinkBody = Static<typeof AdminZohoLinkBodySchema>;

export const ADMIN_ZOHO_LINK_BULK_MAX = 200;

/** Bulk confirmation covers Matched rows only: the server checks each pair is still the match. */
export const AdminZohoLinkBulkBodySchema = Type.Object({
  links: Type.Array(AdminZohoLinkBodySchema, { minItems: 1, maxItems: ADMIN_ZOHO_LINK_BULK_MAX }),
});
export type AdminZohoLinkBulkBody = Static<typeof AdminZohoLinkBulkBodySchema>;

export const AdminZohoLinkOutcomeSchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  registerId: Type.String({ format: "uuid" }),
  /**
   * linked: made now. already_linked: it was linked to this record before (nothing changed).
   * refused: not linked, with the reason in `message`. not_a_match: bulk only; the pair is not
   * the match any more.
   */
  status: Type.Union([
    Type.Literal("linked"),
    Type.Literal("already_linked"),
    Type.Literal("refused"),
    Type.Literal("not_a_match"),
  ]),
  message: Nullable(Type.String()),
  /** Whether the listing is now offered on lax.art in the register. */
  nowOnLaxArt: Type.Boolean(),
  /** The fields Zoho's value replaced. */
  replaced: Type.Array(AdminZohoLinkFieldSchema),
});
export type AdminZohoLinkOutcome = Static<typeof AdminZohoLinkOutcomeSchema>;

export const AdminZohoLinkBulkResultSchema = Type.Object({
  outcomes: Type.Array(AdminZohoLinkOutcomeSchema),
});
export type AdminZohoLinkBulkResult = Static<typeof AdminZohoLinkBulkResultSchema>;

export const ADMIN_ZOHO_UNLINK_REASON_MAX = 500;

export const AdminZohoUnlinkBodySchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  reason: Type.String({ minLength: 1, maxLength: ADMIN_ZOHO_UNLINK_REASON_MAX }),
});
export type AdminZohoUnlinkBody = Static<typeof AdminZohoUnlinkBodySchema>;

export const AdminZohoUnlinkResultSchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  /** False when the artwork was not linked: asking again changes nothing. */
  unlinked: Type.Boolean(),
});
export type AdminZohoUnlinkResult = Static<typeof AdminZohoUnlinkResultSchema>;

export const AdminZohoLinkSettingsSchema = Type.Object({
  blockUnlinkedPublish: Type.Boolean(),
});
export type AdminZohoLinkSettings = Static<typeof AdminZohoLinkSettingsSchema>;
