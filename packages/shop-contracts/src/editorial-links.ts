import { type Static, Type } from "@sinclair/typebox";

/** Upper bound for one curated list; the storefront shows far fewer, so this only stops runaway bodies. */
export const EDITORIAL_LINKS_MAX_IDS = 200;
export const EDITORIAL_LINK_CANDIDATES_DEFAULT_LIMIT = 20;
export const EDITORIAL_LINK_CANDIDATES_MAX_LIMIT = 50;

export const EditorialLinkKindSchema = Type.Union([
  Type.Literal("artwork"),
  Type.Literal("artist"),
  Type.Literal("story"),
  Type.Literal("exhibition"),
]);
export type EditorialLinkKind = Static<typeof EditorialLinkKindSchema>;

/** Everything a picker needs to show one linkable record. */
export const EditorialLinkItemSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  /** The title of an artwork, story or exhibition; the display name of an artist. */
  title: Type.String(),
  slug: Type.String(),
  thumbnailUrl: Type.Union([Type.String(), Type.Null()]),
  /**
   * Whether the public site can show it: published status for stories and exhibitions,
   * the Art sales channel for artworks, always true for artists (they have no draft state).
   */
  published: Type.Boolean(),
});
export type EditorialLinkItem = Static<typeof EditorialLinkItemSchema>;

/**
 * Opaque token for the parent's whole link set (all three lists). Send it back as
 * `expectedVersion`; a mismatch means someone else changed the links first.
 */
const LinksVersionSchema = Type.String({ minLength: 1, maxLength: 64 });

export const EditorialExhibitionLinksResponseSchema = Type.Object({
  artworks: Type.Array(EditorialLinkItemSchema),
  artists: Type.Array(EditorialLinkItemSchema),
  stories: Type.Array(EditorialLinkItemSchema),
  version: LinksVersionSchema,
});
export type EditorialExhibitionLinksResponse = Static<
  typeof EditorialExhibitionLinksResponseSchema
>;

export const EditorialStoryLinksResponseSchema = Type.Object({
  artists: Type.Array(EditorialLinkItemSchema),
  artworks: Type.Array(EditorialLinkItemSchema),
  exhibitions: Type.Array(EditorialLinkItemSchema),
  version: LinksVersionSchema,
});
export type EditorialStoryLinksResponse = Static<typeof EditorialStoryLinksResponseSchema>;

export const EditorialExhibitionLinkListSchema = Type.Union([
  Type.Literal("artworks"),
  Type.Literal("artists"),
  Type.Literal("stories"),
]);
export type EditorialExhibitionLinkList = Static<typeof EditorialExhibitionLinkListSchema>;

export const EditorialStoryLinkListSchema = Type.Union([
  Type.Literal("artists"),
  Type.Literal("artworks"),
  Type.Literal("exhibitions"),
]);
export type EditorialStoryLinkList = Static<typeof EditorialStoryLinkListSchema>;

/**
 * Replaces one whole list. Array order is the display order, except for story and
 * exhibition links, which have no stored order (the public site sorts them by date).
 */
export const EditorialLinksReplaceBodySchema = Type.Object({
  ids: Type.Array(Type.String({ format: "uuid" }), { maxItems: EDITORIAL_LINKS_MAX_IDS }),
  expectedVersion: LinksVersionSchema,
});
export type EditorialLinksReplaceBody = Static<typeof EditorialLinksReplaceBodySchema>;

export const EditorialLinksReplaceResponseSchema = Type.Object({ version: LinksVersionSchema });
export type EditorialLinksReplaceResponse = Static<typeof EditorialLinksReplaceResponseSchema>;

/** 409: the links changed since `expectedVersion`; nothing was written. */
export const EditorialLinksConflictBodySchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
  requestId: Type.Optional(Type.String()),
  currentVersion: LinksVersionSchema,
});
export type EditorialLinksConflictBody = Static<typeof EditorialLinksConflictBodySchema>;

/** 422: some ids do not exist; nothing was written. */
export const EditorialLinksUnknownIdsBodySchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
  requestId: Type.Optional(Type.String()),
  missingIds: Type.Array(Type.String({ format: "uuid" })),
});
export type EditorialLinksUnknownIdsBody = Static<typeof EditorialLinksUnknownIdsBodySchema>;

export const EditorialLinkCandidatesQuerySchema = Type.Object({
  kind: EditorialLinkKindSchema,
  q: Type.Optional(Type.String({ maxLength: 200 })),
  cursor: Type.Optional(Type.String({ maxLength: 512 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: EDITORIAL_LINK_CANDIDATES_MAX_LIMIT })),
});
export type EditorialLinkCandidatesQuery = Static<typeof EditorialLinkCandidatesQuerySchema>;

export const EditorialLinkCandidatesResponseSchema = Type.Object({
  items: Type.Array(EditorialLinkItemSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
});
export type EditorialLinkCandidatesResponse = Static<typeof EditorialLinkCandidatesResponseSchema>;
