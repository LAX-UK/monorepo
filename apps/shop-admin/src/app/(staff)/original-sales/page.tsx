import { AdminFailedPage } from "@/components/admin-fetch-state";
import { OriginalSalesList } from "@/components/sales/original-sales-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { originalSalesList } from "@/server/domain/sales-lists.vm";
import type { AdminOriginalSaleList } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: "Original sales" };

const EMPTY: AdminOriginalSaleList = { items: [], nextCursor: null, counts: {} };

export default async function ShopAdminOriginalSalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = originalSalesList.parse(await searchParams);
  const [result, session] = await Promise.all([
    fetchAdminJson<AdminOriginalSaleList>(
      adminListPath("original-sales", {
        cursor: state.cursor,
        query: originalSalesList.apiQuery(state),
      }),
    ),
    loadAdminSession(),
  ]);
  if (result.status === "unauthorized" || session.status === "unauthorized") redirect("/login");
  if (result.status === "forbidden" || result.status === "not_found") {
    return <AdminFailedPage title="Original sales" status={result.status} />;
  }
  const capabilities = session.status === "ok" ? session.data.capabilities : [];

  return (
    <OriginalSalesList
      state={state}
      page={result.status === "ok" ? result.data : EMPTY}
      loadFailed={result.status === "failed"}
      canSell={capabilities.includes("original_sale.write")}
    />
  );
}
