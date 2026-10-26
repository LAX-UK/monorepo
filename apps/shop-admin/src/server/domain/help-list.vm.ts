import { isUuid } from "@/lib/editorial-entity-forms";
import type { HelpAdminArticleRow, HelpAdminCategoryRow } from "@auction/shop-contracts";
import { type RawSearchParams, singleParam } from "./list-url-state";
import { type WorkListState, type WorkListView, defineWorkList } from "./work-list.vm";

/*
 * The Help centre lists: questions and categories. Both are ordered by their manual position,
 * which is what lax.art shows, so neither has a sortable column; `position` is the one sort
 * key and is never sent to the API.
 */

export const HELP_SEARCH_MAX_LENGTH = 120;

const HELP_VIEWS: readonly WorkListView[] = [
  { id: "all", label: "All", api: {} },
  { id: "published", label: "Published", api: { status: "published" }, statuses: ["published"] },
  { id: "draft", label: "Drafts", api: { status: "draft" }, statuses: ["draft"] },
];

const BY_POSITION = { position: { asc: "position", desc: "position" } };

/** Questions: `category` is a category id and is validated by `parseHelpArticlesState`. */
export const helpArticlesList = defineWorkList<"category">({
  path: "/help",
  views: HELP_VIEWS,
  defaultView: "all",
  filters: { category: [] },
  sorts: BY_POSITION,
  defaultSort: "position",
  panelParam: "article",
  searchMaxLength: HELP_SEARCH_MAX_LENGTH,
});

export const helpCategoriesList = defineWorkList({
  path: "/help/categories",
  views: HELP_VIEWS,
  defaultView: "all",
  filters: {},
  sorts: BY_POSITION,
  defaultSort: "position",
  panelParam: "category",
  searchMaxLength: HELP_SEARCH_MAX_LENGTH,
});

export type HelpArticlesState = WorkListState<"category">;

/** The URL state of the questions list; a category in the URL must be an id, never free text. */
export function parseHelpArticlesState(params: RawSearchParams): HelpArticlesState {
  const state = helpArticlesList.parse(params);
  const category = singleParam(params.category);
  return category && isUuid(category)
    ? { ...state, filters: { ...state.filters, category } }
    : state;
}

export function parseHelpCategoriesState(params: RawSearchParams): WorkListState {
  return helpCategoriesList.parse(params);
}

/** The query for the admin API. Status is applied on the page so every view can be counted. */
export function helpArticlesApiPath(state: HelpArticlesState): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.filters.category) params.set("categoryId", state.filters.category);
  const query = params.toString();
  return `help/articles${query ? `?${query}` : ""}`;
}

/** Rows per status, for the view tabs. */
export function statusCounts(rows: readonly { status: string }[]): Record<string, number> {
  const counts: Record<string, number> = { published: 0, draft: 0 };
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return counts;
}

/** The rows a view shows. */
export function inView<T extends { status: string }>(rows: readonly T[], view: string): T[] {
  return view === "published" || view === "draft"
    ? rows.filter((row) => row.status === view)
    : [...rows];
}

export type HelpArticleListRow = {
  id: string;
  question: string;
  slug: string;
  categoryId: string;
  categoryTitle: string;
  status: HelpAdminArticleRow["status"];
  /** ISO time of the last change. */
  updatedAt: string;
  /** Who made it, by name; null when the API does not know them. */
  updatedByName: string | null;
};

export function toHelpArticleListRow(row: HelpAdminArticleRow): HelpArticleListRow {
  return {
    id: row.id,
    question: row.question,
    slug: row.slug,
    categoryId: row.categoryId,
    categoryTitle: row.categoryTitle,
    status: row.status,
    updatedAt: row.updatedAt,
    updatedByName: row.updatedByName?.trim() || null,
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
