import { AdminFailedPage } from "@/components/admin-fetch-state";
import { ThirdPartySalesList } from "@/components/sales/third-party-sales-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { thirdPartySalesList } from "@/server/domain/sales-lists.vm";
import type { AdminThirdPartySaleList } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: "Third-party sales" };

const EMPTY: AdminThirdPartySaleList = { items: [], nextCursor: null, counts: {} };

export default async function ThirdPartySalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = thirdPartySalesList.parse(await searchParams);
  const [result, session] = await Promise.all([
    fetchAdminJson<AdminThirdPartySaleList>(
      adminListPath("third-party-sales", {
        cursor: state.cursor,
        query: thirdPartySalesList.apiQuery(state),
      }),
    ),
    loadAdminSession(),
  ]);
  if (result.status === "unauthorized" || session.status === "unauthorized") redirect("/login");
  if (result.status === "forbidden" || result.status === "not_found") {
    return <AdminFailedPage title="Third-party sales" status={result.status} />;
  }
  const capabilities = session.status === "ok" ? session.data.capabilities : [];

  return (
    <ThirdPartySalesList
      state={state}
      page={result.status === "ok" ? result.data : EMPTY}
      loadFailed={result.status === "failed"}
      canRecord={capabilities.includes("third_party_sale.write")}
      canApproveFees={capabilities.includes("fee.approve")}
    />
  );
}
