import { ART_SLUG_LOOKUP } from "@/lib/art-catalogue.server";
import { fetchEditorial } from "@/lib/editorial/art-editorial.server";
import type { ArtEditorialFetchResult } from "@/lib/editorial/art-editorial.types";
import type { ArtHelpArticleFilter } from "@/lib/help/art-help.types";
import {
  HelpArticleDetailSchema,
  HelpArticleListSchema,
  HelpCategoryListSchema,
} from "@auction/shop-contracts";
import type {
  HelpArticleDetail,
  HelpArticleSummary,
  HelpCategorySummary,
} from "@auction/shop-contracts";

/**
 * Help reads share the editorial flag and cache tag: staff writes already purge `art:editorial`,
 * so a published answer appears without a second invalidation path. Search terms are free text,
 * so those reads skip the cache rather than create an entry per query.
 */
const UNCACHED: RequestInit = { cache: "no-store" };

export function fetchHelpCategories(): Promise<
  ArtEditorialFetchResult<{ items: HelpCategorySummary[] }>
> {
  return fetchEditorial("/v1/help/categories", HelpCategoryListSchema);
}

export function fetchHelpArticles({
  categorySlug,
  q,
}: ArtHelpArticleFilter = {}): Promise<ArtEditorialFetchResult<{ items: HelpArticleSummary[] }>> {
  const params = new URLSearchParams();
  if (categorySlug) params.set("category", categorySlug);
  if (q) params.set("q", q);
  const query = params.size > 0 ? `?${params}` : "";
  return fetchEditorial(
    `/v1/help/articles${query}`,
    HelpArticleListSchema,
    q ? UNCACHED : undefined,
  );
}

export function fetchHelpArticleBySlug(
  slug: string,
): Promise<ArtEditorialFetchResult<HelpArticleDetail>> {
  return fetchEditorial(
    `/v1/help/articles/${encodeURIComponent(slug)}`,
    HelpArticleDetailSchema,
    ART_SLUG_LOOKUP,
  );
}
