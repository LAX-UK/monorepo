import {
  type EditorialBodyVm,
  composeEditorialBody,
} from "@/lib/editorial/editorial-body.composer";
import type { ArtEditorialPageResult } from "@/lib/editorial/editorial-pages.composer";
import {
  type HelpCategoryChipVm,
  type HelpQuestionGroupVm,
  type HelpRelatedQuestionVm,
  type HelpSearchResultVm,
  type HelpUrlState,
  buildHelpCategoryChips,
  buildHelpSearchResults,
  buildRelatedQuestions,
  groupHelpQuestions,
  helpArticleHref,
  helpCategoryHref,
  helpResultsSummary,
} from "@/lib/help/help.vm";
import type {
  ArtCataloguePort,
  ArtFavoritesReadPort,
  ArtHelpPort,
  ArtViewerPort,
} from "@/lib/ports";
import type { HelpArticleDetail } from "@auction/shop-contracts";

export type HelpIndexVm = {
  /** The search term, empty when browsing. */
  query: string;
  categories: HelpCategoryChipVm[];
  content:
    | { kind: "search"; summary: string; results: HelpSearchResultVm[] }
    | {
        kind: "browse";
        /** Set when the URL names an existing category, so the page can say which one it shows. */
        selectedTitle: string | null;
        groups: HelpQuestionGroupVm[];
      };
};

/**
 * Search wins over a category filter: a typed term looks across every category. Browsing reads
 * every question once and narrows to the selected category here, so all browse views share one
 * cached read and an unknown `?category=` simply shows everything.
 */
export async function composeHelpIndexPage(
  services: { help: Pick<ArtHelpPort, "listCategories" | "listArticles"> },
  state: HelpUrlState,
): Promise<ArtEditorialPageResult<HelpIndexVm>> {
  const [categories, articles] = await Promise.all([
    services.help.listCategories(),
    services.help.listArticles(state.q ? { q: state.q } : {}),
  ]);
  if (categories.status !== "ok") return categories;
  if (articles.status !== "ok") return articles;

  const selected = categories.data.items.find((category) => category.slug === state.category);
  const chips = buildHelpCategoryChips(categories.data.items, selected?.slug ?? null);

  if (state.q) {
    const results = buildHelpSearchResults(articles.data.items);
    return {
      status: "ok",
      data: {
        query: state.q,
        categories: chips,
        content: {
          kind: "search",
          summary: helpResultsSummary(state.q, results.length),
          results,
        },
      },
    };
  }

  const visible = selected ? [selected] : categories.data.items;
  return {
    status: "ok",
    data: {
      query: "",
      categories: chips,
      content: {
        kind: "browse",
        selectedTitle: selected?.title ?? null,
        groups: groupHelpQuestions(visible, articles.data.items),
      },
    },
  };
}

export type HelpArticlePageVm = {
  article: HelpArticleDetail;
  path: string;
  body: EditorialBodyVm;
  categoryHref: string;
  /** The category's questions with this one marked; empty when it is the only question. */
  related: HelpRelatedQuestionVm[];
};

export async function composeHelpArticlePage(
  services: {
    help: Pick<ArtHelpPort, "getArticle" | "listArticles">;
    catalogue: Pick<ArtCataloguePort, "getArtwork" | "getArtist">;
    viewer: ArtViewerPort;
    favorites: ArtFavoritesReadPort;
  },
  slug: string,
): Promise<ArtEditorialPageResult<HelpArticlePageVm>> {
  const result = await services.help.getArticle(slug);
  if (result.status !== "ok") return result;
  const article = result.data;
  const path = helpArticleHref(article.slug);
  const [siblings, body] = await Promise.all([
    services.help.listArticles({ categorySlug: article.categorySlug }),
    composeEditorialBody(article.answer, services, path),
  ]);
  // A failed sibling read only costs the side list; the answer itself still renders.
  const related =
    siblings.status === "ok" ? buildRelatedQuestions(siblings.data.items, article.slug) : [];
  return {
    status: "ok",
    data: {
      article,
      path,
      body,
      categoryHref: helpCategoryHref(article.categorySlug),
      related: related.length > 1 ? related : [],
    },
  };
}
