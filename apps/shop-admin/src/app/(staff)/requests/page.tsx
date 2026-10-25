import { AdminFailedPage } from "@/components/admin-fetch-state";
import { SaleRequestsList } from "@/components/requests/sale-requests-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { saleRequestsList } from "@/server/domain/sales-lists.vm";
import type { AdminSaleAuthorityRequestList } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: "Sale limit requests" };

const EMPTY: AdminSaleAuthorityRequestList = { items: [], nextCursor: null };

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = saleRequestsList.parse(await searchParams);
  const [result, session] = await Promise.all([
    fetchAdminJson<AdminSaleAuthorityRequestList>(
      adminListPath("sale-authority-requests", {
        cursor: state.cursor,
        query: saleRequestsList.apiQuery(state),
      }),
    ),
    loadAdminSession(),
  ]);
  if (result.status === "unauthorized" || session.status === "unauthorized") redirect("/login");
  if (result.status === "forbidden" || result.status === "not_found") {
    return <AdminFailedPage title="Sale limit requests" status={result.status} />;
  }
  const capabilities = session.status === "ok" ? session.data.capabilities : [];

  return (
    <SaleRequestsList
      state={state}
      page={result.status === "ok" ? result.data : EMPTY}
      loadFailed={result.status === "failed"}
      canDecide={capabilities.includes("sale_authority.write")}
    />
  );
}
