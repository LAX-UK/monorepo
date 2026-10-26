import { AdminFailedPage } from "@/components/admin-fetch-state";
import { HelpArticlesList } from "@/components/help/help-articles-list.client";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { getShopAdminContainer } from "@/server/container";
import {
  helpArticlesApiPath,
  inView,
  parseHelpArticlesState,
  statusCounts,
  toHelpArticleListRow,
} from "@/server/domain/help-list.vm";
import type { HelpAdminArticleRow, HelpAdminCategoryRow } from "@auction/shop-contracts";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Help centre" };

export default async function HelpCentrePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = parseHelpArticlesState(await searchParams);
  const [articles, categories] = await Promise.all([
    fetchAdminJson<{ items: HelpAdminArticleRow[] }>(helpArticlesApiPath(state)),
    fetchAdminJson<{ items: HelpAdminCategoryRow[] }>("help/categories"),
  ]);
  if (articles.status === "unauthorized" || categories.status === "unauthorized") {
    redirect("/login");
  }
  for (const result of [articles, categories]) {
    if (result.status === "forbidden" || result.status === "not_found") {
      return <AdminFailedPage title="Help centre" status={result.status} />;
    }
  }

  const loaded = articles.status === "ok" ? articles.data.items.map(toHelpArticleListRow) : [];
  return (
    <HelpArticlesList
      state={state}
      rows={inView(loaded, state.view)}
      counts={statusCounts(loaded)}
      categories={
        categories.status === "ok"
          ? categories.data.items.map((category) => ({ id: category.id, title: category.title }))
          : []
      }
      artPublicUrl={getShopAdminContainer().config.artPublicUrl ?? null}
      loadFailed={articles.status !== "ok" || categories.status !== "ok"}
    />
  );
}
