import { AdminFailedPage } from "@/components/admin-fetch-state";
import { HoldsList } from "@/components/sales/holds-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { holdsList } from "@/server/domain/sales-lists.vm";
import type { AdminStockHoldList } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: "Stock holds" };

const EMPTY: AdminStockHoldList = { items: [], nextCursor: null };

export default async function HoldsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = holdsList.parse(await searchParams);
  const [result, session] = await Promise.all([
    fetchAdminJson<AdminStockHoldList>(
      adminListPath("stock-holds", { cursor: state.cursor, query: holdsList.apiQuery(state) }),
    ),
    loadAdminSession(),
  ]);
  if (result.status === "unauthorized" || session.status === "unauthorized") redirect("/login");
  if (result.status === "forbidden" || result.status === "not_found") {
    return <AdminFailedPage title="Stock holds" status={result.status} />;
  }
  const capabilities = session.status === "ok" ? session.data.capabilities : [];

  return (
    <HoldsList
      state={state}
      page={result.status === "ok" ? result.data : EMPTY}
      loadFailed={result.status === "failed"}
      canHold={capabilities.includes("stock_hold.write")}
    />
  );
}
