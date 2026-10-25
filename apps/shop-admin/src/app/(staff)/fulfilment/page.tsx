import { AdminFailedPage } from "@/components/admin-fetch-state";
import { FulfilmentList } from "@/components/orders/fulfilment-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { fulfilmentList } from "@/server/domain/sales-lists.vm";
import type { AdminFulfilmentList } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: "Fulfilment" };

const EMPTY: AdminFulfilmentList = { items: [], nextCursor: null, counts: {} };

export default async function ShopAdminFulfilmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = fulfilmentList.parse(await searchParams);
  const result = await fetchAdminJson<AdminFulfilmentList>(
    adminListPath("fulfilment", { cursor: state.cursor, query: fulfilmentList.apiQuery(state) }),
  );
  if (result.status === "unauthorized") redirect("/login");
  if (result.status === "forbidden" || result.status === "not_found") {
    return <AdminFailedPage title="Fulfilment" status={result.status} />;
  }

  return (
    <FulfilmentList
      state={state}
      page={result.status === "ok" ? result.data : EMPTY}
      loadFailed={result.status === "failed"}
    />
  );
}
