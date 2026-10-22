import { ArtHelpArticle } from "@/components/help/art-help-article";
import { ArtJsonLd } from "@/components/seo/art-json-ld";
import { loadArtStorefrontBaseUrl } from "@/env.server";
import { artServices } from "@/lib/art-services.server";
import { composeHelpArticlePage } from "@/lib/help/help-pages.composer";
import { helpArticleJsonLd } from "@/lib/seo/art-structured-data";
import { notFoundOrUnavailable } from "@/lib/seo/page-status";
import { seoMetadataDescription, seoMetadataTitle } from "@/lib/seo/seo-metadata";
import { editorialBlocksPlainText } from "@auction/shop-contracts";
import type { Metadata } from "next";
import { cache } from "react";

type HelpArticlePageProps = {
  params: Promise<{ slug: string }>;
};

/** One read per request, shared by `generateMetadata` and the page body. */
const loadHelpArticle = cache((slug: string) => composeHelpArticlePage(artServices, slug));

export async function generateMetadata({ params }: HelpArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadHelpArticle(slug);
  if (result.status !== "ok") notFoundOrUnavailable(result.status, "Help answer");
  const { article, path } = result.data;
  const description = seoMetadataDescription(article, editorialBlocksPlainText(article.answer));
  return {
    title: seoMetadataTitle(article, article.question),
    ...(description ? { description } : {}),
    alternates: { canonical: path },
  };
}

export default async function HelpArticlePage({ params }: HelpArticlePageProps) {
  const { slug } = await params;
  const result = await loadHelpArticle(slug);
  if (result.status !== "ok") notFoundOrUnavailable(result.status, "Help answer");
  return (
    <>
      <ArtJsonLd data={helpArticleJsonLd(result.data.article, loadArtStorefrontBaseUrl())} />
      <ArtHelpArticle page={result.data} />
    </>
  );
}
