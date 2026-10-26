import { AdminFailedPage } from "@/components/admin-fetch-state";
import { HelpCategoriesList } from "@/components/help/help-categories-list.client";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import {
  inView,
  parseHelpCategoriesState,
  statusCounts,
  toHelpCategoryListRow,
} from "@/server/domain/help-list.vm";
import type { HelpAdminCategoryRow } from "@auction/shop-contracts";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Help centre categories" };

export default async function HelpCategoriesRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = parseHelpCategoriesState(await searchParams);
  const result = await fetchAdminJson<{ items: HelpAdminCategoryRow[] }>("help/categories");
  if (result.status === "unauthorized") redirect("/login");
  if (result.status === "forbidden" || result.status === "not_found") {
    return <AdminFailedPage title="Help centre categories" status={result.status} />;
  }

  // The API lists every category in order; the search is by title, applied here.
  const term = state.q?.toLowerCase();
  const matching = (result.status === "ok" ? result.data.items : [])
    .map(toHelpCategoryListRow)
    .filter((row) => !term || row.title.toLowerCase().includes(term));
  return (
    <HelpCategoriesList
      state={state}
      rows={inView(matching, state.view)}
      counts={statusCounts(matching)}
      loadFailed={result.status !== "ok"}
    />
  );
}
