import type {
  EditorialBlock,
  HelpAdminArticleDetail,
  HelpAdminArticleListQuery,
  HelpAdminArticleRow,
  HelpAdminCategoryRow,
  HelpArticleDetail,
  HelpArticleSummary,
  HelpCategorySummary,
  SeoFields,
} from "@auction/shop-contracts";
import type { EditorialUpdateOutcome } from "./editorial.repository.js";

/** Omitted leaves the stored value unchanged on update; `null` clears it. */
type SeoFieldsInput = Partial<SeoFields>;

export type HelpArticleInput = SeoFieldsInput & {
  categoryId: string;
  slug: string;
  question: string;
  body: EditorialBlock[];
  updatedBy: string;
};

export type HelpCategoryInput = { slug: string; title: string; updatedBy: string };

/**
 * `unknown_category` means an article names a category that does not exist; `not_empty` means a
 * category still has questions; `list_changed` means a reorder did not name exactly the rows
 * that exist now, so the caller's view is stale.
 */
export type HelpWriteOutcome<T> =
  | { status: "ok"; value: T }
  | { status: "not_found" }
  | { status: "unknown_category" }
  | { status: "not_empty" }
  | { status: "list_changed" };

export type HelpArticleUpdateOutcome = EditorialUpdateOutcome | { status: "unknown_category" };

/** Help centre content: what lax.art reads, and what LAX Admin edits. */
export interface HelpRepository {
  /** Published categories with the count of their published questions, in display order. */
  listCategories(): Promise<HelpCategorySummary[]>;
  /** Published questions in published categories; `q` matches the question and the answer text. */
  listArticles(filter: { categorySlug?: string; q?: string }): Promise<HelpArticleSummary[]>;
  getArticleBySlug(slug: string): Promise<HelpArticleDetail | null>;

  listAdminCategories(): Promise<HelpAdminCategoryRow[]>;
  createCategory(input: HelpCategoryInput): Promise<{ id: string }>;
  updateCategory(
    id: string,
    input: HelpCategoryInput & { expectedVersion: string },
  ): Promise<EditorialUpdateOutcome>;
  setCategoryPublication(id: string, published: boolean, updatedBy: string): Promise<boolean>;
  deleteCategory(id: string, actor: string): Promise<HelpWriteOutcome<null>>;
  reorderCategories(ids: string[], actor: string): Promise<HelpWriteOutcome<null>>;

  listAdminArticles(filter: HelpAdminArticleListQuery): Promise<HelpAdminArticleRow[]>;
  getAdminArticleById(id: string): Promise<HelpAdminArticleDetail | null>;
  createArticle(input: HelpArticleInput): Promise<HelpWriteOutcome<{ id: string }>>;
  updateArticle(
    id: string,
    input: HelpArticleInput & { expectedVersion: string },
  ): Promise<HelpArticleUpdateOutcome>;
  setArticlePublication(id: string, published: boolean, updatedBy: string): Promise<boolean>;
  deleteArticle(id: string, actor: string): Promise<boolean>;
  reorderArticles(
    categoryId: string,
    ids: string[],
    actor: string,
  ): Promise<HelpWriteOutcome<null>>;
}
