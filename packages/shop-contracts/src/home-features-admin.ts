import { type Static, Type } from "@sinclair/typebox";

/**
 * LAX Admin's Featured on home: the ordered prints, artists and categories the Shop home (and,
 * for artists, lax.art) features. Each row carries the facts its status line is worked out from,
 * by the rules in `@auction/shop-domain`. The slot and issue lists mirror `HOME_FEATURE_SLOTS` and
 * `HomeFeatureIssueReason` there; shop-api checks the lists agree.
 */

export const ADMIN_HOME_FEATURE_SLOT_VALUES = [
  "featured_prints",
  "featured_artists",
  "featured_categories",
] as const;

export const AdminHomeFeatureSlotSchema = Type.Union(
  ADMIN_HOME_FEATURE_SLOT_VALUES.map((slot) => Type.Literal(slot)),
);
export type AdminHomeFeatureSlot = Static<typeof AdminHomeFeatureSlotSchema>;

export const AdminHomeFeatureSlotParamsSchema = Type.Object({ slot: AdminHomeFeatureSlotSchema });

export const AdminHomeFeaturePrintSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  title: Type.String(),
  artistName: Type.String(),
  thumbnailUrl: Type.Union([Type.String(), Type.Null()]),
  /** Published, not archived, and listed on the Shop. */
  live: Type.Boolean(),
  soldOut: Type.Boolean(),
  hasImage: Type.Boolean(),
});
export type AdminHomeFeaturePrint = Static<typeof AdminHomeFeaturePrintSchema>;

export const AdminHomeFeatureArtistSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  name: Type.String(),
  discipline: Type.Union([Type.String(), Type.Null()]),
  portraitUrl: Type.Union([Type.String(), Type.Null()]),
  /** Not archived, with an original on lax.art. */
  onArt: Type.Boolean(),
  /** Not archived, with a Shop edition on sale. */
  hasEditionsOnSale: Type.Boolean(),
});
export type AdminHomeFeatureArtist = Static<typeof AdminHomeFeatureArtistSchema>;

export const AdminHomeFeatureCategorySchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  name: Type.String(),
  /** Live Shop editions in the category. */
  editionCount: Type.Integer({ minimum: 0 }),
});
export type AdminHomeFeatureCategory = Static<typeof AdminHomeFeatureCategorySchema>;

export const AdminHomeFeaturesSchema = Type.Object({
  featured_prints: Type.Array(AdminHomeFeaturePrintSchema),
  featured_artists: Type.Array(AdminHomeFeatureArtistSchema),
  featured_categories: Type.Array(AdminHomeFeatureCategorySchema),
});
export type AdminHomeFeatures = Static<typeof AdminHomeFeaturesSchema>;

/** A row of any slot, as the slot it belongs to holds it. */
export type AdminHomeFeatureRow<S extends AdminHomeFeatureSlot> = AdminHomeFeatures[S][number];

/** The bound on one save; every slot holds far fewer. */
export const ADMIN_HOME_FEATURE_MAX_IDS = 50;

/** Replaces one slot's list, in order. An empty list clears the slot. */
export const AdminHomeFeatureReplaceBodySchema = Type.Object({
  ids: Type.Array(Type.String({ format: "uuid" }), { maxItems: ADMIN_HOME_FEATURE_MAX_IDS }),
});
export type AdminHomeFeatureReplaceBody = Static<typeof AdminHomeFeatureReplaceBodySchema>;

export const AdminHomeFeatureCandidatesSchema = Type.Object({
  items: Type.Union([
    Type.Array(AdminHomeFeaturePrintSchema),
    Type.Array(AdminHomeFeatureArtistSchema),
    Type.Array(AdminHomeFeatureCategorySchema),
  ]),
});

/** Why a save was refused, row by row; `index` is the row's place in the list sent. */
export const AdminHomeFeatureIssueSchema = Type.Object({
  index: Type.Integer({ minimum: 0 }),
  targetId: Type.String(),
  reason: Type.Union([
    Type.Literal("unknown"),
    Type.Literal("duplicate"),
    Type.Literal("not_a_shop_edition"),
    Type.Literal("over_limit"),
  ]),
});
export type AdminHomeFeatureIssue = Static<typeof AdminHomeFeatureIssueSchema>;

export const AdminHomeFeatureRejectedBodySchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
  requestId: Type.Optional(Type.String()),
  /** Absent when the request itself was malformed. */
  issues: Type.Optional(Type.Array(AdminHomeFeatureIssueSchema)),
});
