import { isUuid } from "@/lib/editorial-entity-forms";
import { formatLondonDateTime } from "@/lib/editorial-time";
import type { HelpAdminArticleRow, HelpAdminCategoryRow } from "@auction/shop-contracts";

export type HelpStatusFilter = "all" | "published" | "draft";

/** List state that lives in the URL, so a filtered view can be shared and survives a refresh. */
export type HelpArticleListSearch = {
  q: string;
  status: HelpStatusFilter;
  /** A category id, or null for every category. */
  categoryId: string | null;
};

type SearchParams = {
  q?: string | string[];
  status?: string | string[];
  category?: string | string[];
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export function parseHelpArticleListSearch(params: SearchParams): HelpArticleListSearch {
  const status = first(params.status);
  const category = first(params.category);
  return {
    q: first(params.q).replace(/\s+/g, " ").trim().slice(0, 120),
    status: status === "published" || status === "draft" ? status : "all",
    categoryId: isUuid(category) ? category : null,
  };
}

export function isFilteredHelpArticleList(search: HelpArticleListSearch): boolean {
  return Boolean(search.q) || search.status !== "all" || search.categoryId !== null;
}

/** The query string for the admin API; the filters are applied there, not on the page. */
export function helpArticlesApiPath(search: HelpArticleListSearch): string {
  const params = new URLSearchParams();
  if (search.q) params.set("q", search.q);
  if (search.status !== "all") params.set("status", search.status);
  if (search.categoryId) params.set("categoryId", search.categoryId);
  const query = params.toString();
  return `help/articles${query ? `?${query}` : ""}`;
}

export function helpArticleListUrl(search: HelpArticleListSearch): string {
  const params = new URLSearchParams();
  if (search.q) params.set("q", search.q);
  if (search.status !== "all") params.set("status", search.status);
  if (search.categoryId) params.set("category", search.categoryId);
  const query = params.toString();
  return `/help${query ? `?${query}` : ""}`;
}

export type HelpArticleListRow = {
  id: string;
  question: string;
  slug: string;
  categoryTitle: string;
  status: HelpAdminArticleRow["status"];
  updated: string;
};

export function toHelpArticleListRow(row: HelpAdminArticleRow): HelpArticleListRow {
  return {
    id: row.id,
    question: row.question,
    slug: row.slug,
    categoryTitle: row.categoryTitle,
    status: row.status,
    updated: formatLondonDateTime(row.updatedAt),
  };
}

export type HelpCategoryListRow = {
  id: string;
  title: string;
  slug: string;
  status: HelpAdminCategoryRow["status"];
  /** "3 questions, 2 published". */
  counts: string;
  /** The version to send back when the category is edited. */
  updatedAt: string;
  articleCount: number;
};

export function toHelpCategoryListRow(row: HelpAdminCategoryRow): HelpCategoryListRow {
  const questions = `${row.articleCount} ${row.articleCount === 1 ? "question" : "questions"}`;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    counts:
      row.articleCount === 0 ? questions : `${questions}, ${row.publishedArticleCount} published`,
    updatedAt: row.updatedAt,
    articleCount: row.articleCount,
  };
}

/**
 * The order after moving one row a place up or down, or null at either end. The whole order is
 * what the API stores, so the caller sends this list rather than a single move.
 */
export function movedOrder(
  ids: readonly string[],
  id: string,
  direction: "up" | "down",
): string[] | null {
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= ids.length) return null;
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return null;
  next.splice(to, 0, moved);
  return next;
}
