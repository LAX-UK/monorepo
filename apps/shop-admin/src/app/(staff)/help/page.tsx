import { HelpArticlesListPage } from "@/components/help/help-articles-list-page";
import { parseHelpArticleListSearch } from "@/server/domain/help-list.vm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Help centre" };

export default async function HelpCentrePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    status?: string | string[];
    category?: string | string[];
  }>;
}) {
  return <HelpArticlesListPage search={parseHelpArticleListSearch(await searchParams)} />;
}
