import type { HelpArticleSummary, HelpCategorySummary } from "@auction/shop-contracts";
import { HELP_SEARCH_MAX_LENGTH } from "@auction/shop-contracts";

export const HELP_ROUTE = "/help";

export function helpArticleHref(slug: string): string {
  return `${HELP_ROUTE}/${encodeURIComponent(slug)}`;
}

export function helpCategoryHref(slug: string): string {
  return `${HELP_ROUTE}?category=${encodeURIComponent(slug)}`;
}

export type HelpSearchParams = Record<string, string | string[] | undefined>;

export type HelpUrlState = {
  /** Whitespace-collapsed search term; empty when not searching. */
  q: string;
  /** A well-formed category slug from the URL; whether it exists is for the composer to decide. */
  category: string | null;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Hand-typed URLs can carry anything; malformed values fall back to "not set" instead of erroring. */
export function parseHelpParams(params: HelpSearchParams): HelpUrlState {
  const q = (first(params.q) ?? "").replace(/\s+/g, " ").trim().slice(0, HELP_SEARCH_MAX_LENGTH);
  const category = first(params.category)?.trim() ?? "";
  return { q, category: SLUG_PATTERN.test(category) ? category : null };
}

export type HelpCategoryChipVm = {
  slug: string;
  title: string;
  href: string;
  selected: boolean;
  /** Published questions in the category. */
  count: number;
};

export type HelpQuestionLinkVm = { question: string; href: string };

export type HelpQuestionGroupVm = {
  slug: string;
  title: string;
  href: string;
  questions: HelpQuestionLinkVm[];
};

export type HelpSearchResultVm = HelpQuestionLinkVm & { categoryTitle: string };

export function buildHelpCategoryChips(
  categories: readonly HelpCategorySummary[],
  selectedSlug: string | null,
): HelpCategoryChipVm[] {
  return categories.map((category) => ({
    slug: category.slug,
    title: category.title,
    href: helpCategoryHref(category.slug),
    selected: category.slug === selectedSlug,
    count: category.articleCount,
  }));
}

/** Questions under their category, in the categories' display order; a category with none is left out. */
export function groupHelpQuestions(
  categories: readonly HelpCategorySummary[],
  articles: readonly HelpArticleSummary[],
): HelpQuestionGroupVm[] {
  return categories.flatMap((category) => {
    const questions = articles
      .filter((article) => article.categorySlug === category.slug)
      .map((article) => ({ question: article.question, href: helpArticleHref(article.slug) }));
    return questions.length > 0
      ? [
          {
            slug: category.slug,
            title: category.title,
            href: helpCategoryHref(category.slug),
            questions,
          },
        ]
      : [];
  });
}

export function buildHelpSearchResults(
  articles: readonly HelpArticleSummary[],
): HelpSearchResultVm[] {
  return articles.map((article) => ({
    question: article.question,
    href: helpArticleHref(article.slug),
    categoryTitle: article.categoryTitle,
  }));
}

/** Announced to screen readers when a search replaces the page content. */
export function helpResultsSummary(query: string, count: number): string {
  if (count === 0) return `No results for “${query}”`;
  return `${count} ${count === 1 ? "result" : "results"} for “${query}”`;
}

export type HelpRelatedQuestionVm = HelpQuestionLinkVm & { current: boolean };

/** The category's questions with the one being read marked, as the answer page's side list shows them. */
export function buildRelatedQuestions(
  articles: readonly HelpArticleSummary[],
  currentSlug: string,
): HelpRelatedQuestionVm[] {
  return articles.map((article) => ({
    question: article.question,
    href: helpArticleHref(article.slug),
    current: article.slug === currentSlug,
  }));
}
