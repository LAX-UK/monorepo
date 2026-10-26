import { type Static, Type } from "@sinclair/typebox";
import { EditorialSlugBodyField, EditorialVersionSchema } from "./editorial-admin.js";
import { EditorialBlockListSchema } from "./editorial-blocks.js";
import { PublicSeoFieldsProperties, SeoFieldsWriteProperties } from "./seo-fields.js";

/** Longest search term the public and admin lists accept. */
export const HELP_SEARCH_MAX_LENGTH = 120;

/** Most questions one list returns; the Help centre is small enough that it never pages. */
export const HELP_ARTICLE_LIST_LIMIT = 100;

const HelpStatusSchema = Type.Union([Type.Literal("draft"), Type.Literal("published")]);
const SearchTermSchema = Type.String({ minLength: 1, maxLength: HELP_SEARCH_MAX_LENGTH });

// ---- Public (lax.art) ----

/** Counts cover published questions only, so a category with none is never shown as having some. */
export const HelpCategorySummarySchema = Type.Object({
  slug: Type.String(),
  title: Type.String(),
  articleCount: Type.Integer({ minimum: 0 }),
});

export const HelpCategoryListSchema = Type.Object({ items: Type.Array(HelpCategorySummarySchema) });

export const HelpArticleSummarySchema = Type.Object({
  slug: Type.String(),
  question: Type.String(),
  categorySlug: Type.String(),
  categoryTitle: Type.String(),
});

export const HelpArticleListSchema = Type.Object({ items: Type.Array(HelpArticleSummarySchema) });

export const HelpArticleDetailSchema = Type.Composite([
  HelpArticleSummarySchema,
  Type.Object({
    answer: EditorialBlockListSchema,
    updatedAt: Type.String({ format: "date-time" }),
    ...PublicSeoFieldsProperties,
  }),
]);

/** `/v1/help/articles` filters. `q` matches the question and the answer text. */
export const HelpArticleListQuerySchema = Type.Object({
  category: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
  q: Type.Optional(SearchTermSchema),
});

// ---- Admin ----

export const HelpCategoryWriteBodySchema = Type.Object({
  slug: EditorialSlugBodyField,
  title: Type.String({ minLength: 1, maxLength: 200 }),
});

export const HelpCategoryUpdateBodySchema = Type.Composite([
  HelpCategoryWriteBodySchema,
  Type.Object({ expectedVersion: EditorialVersionSchema }),
]);

export const HelpArticleWriteBodySchema = Type.Object({
  categoryId: Type.String({ format: "uuid" }),
  slug: EditorialSlugBodyField,
  question: Type.String({ minLength: 1, maxLength: 300 }),
  body: EditorialBlockListSchema,
  ...SeoFieldsWriteProperties,
});

export const HelpArticleUpdateBodySchema = Type.Composite([
  HelpArticleWriteBodySchema,
  Type.Object({ expectedVersion: EditorialVersionSchema }),
]);

/** The complete new order of one list, first to last. Ids that are not in the list are rejected. */
export const HelpOrderBodySchema = Type.Object({
  ids: Type.Array(Type.String({ format: "uuid" }), { minItems: 1, maxItems: 200 }),
});

export const HelpAdminCategoryRowSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  slug: Type.String(),
  title: Type.String(),
  position: Type.Integer(),
  status: HelpStatusSchema,
  updatedAt: Type.String({ format: "date-time" }),
  articleCount: Type.Integer({ minimum: 0 }),
  publishedArticleCount: Type.Integer({ minimum: 0 }),
});

export const HelpAdminArticleRowSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  slug: Type.String(),
  question: Type.String(),
  categoryId: Type.String({ format: "uuid" }),
  categoryTitle: Type.String(),
  position: Type.Integer(),
  status: HelpStatusSchema,
  updatedAt: Type.String({ format: "date-time" }),
  updatedBy: Type.Union([Type.String(), Type.Null()]),
  /** The name (or email) of the staff member who last changed it; optional for an older API. */
  updatedByName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

export const HelpAdminArticleDetailSchema = Type.Composite([
  HelpAdminArticleRowSchema,
  Type.Object({
    body: Type.Array(Type.Unknown()),
    seoTitle: Type.Union([Type.String(), Type.Null()]),
    seoDescription: Type.Union([Type.String(), Type.Null()]),
  }),
]);

export const HelpAdminArticleListQuerySchema = Type.Object({
  categoryId: Type.Optional(Type.String({ format: "uuid" })),
  status: Type.Optional(HelpStatusSchema),
  q: Type.Optional(SearchTermSchema),
});

export type HelpCategorySummary = Static<typeof HelpCategorySummarySchema>;
export type HelpArticleSummary = Static<typeof HelpArticleSummarySchema>;
export type HelpArticleDetail = Static<typeof HelpArticleDetailSchema>;
export type HelpAdminCategoryRow = Static<typeof HelpAdminCategoryRowSchema>;
export type HelpAdminArticleRow = Static<typeof HelpAdminArticleRowSchema>;
export type HelpAdminArticleDetail = Static<typeof HelpAdminArticleDetailSchema>;
export type HelpAdminArticleListQuery = Static<typeof HelpAdminArticleListQuerySchema>;
