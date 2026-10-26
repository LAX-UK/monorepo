import { AdminFailedPage } from "@/components/admin-fetch-state";
import { MerchandiseList } from "@/components/merchandise/merchandise-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { merchandiseList, toMerchandiseListRow } from "@/server/domain/merchandise-list.vm";
import type { MerchandiseProductList } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: "Products" };

export default async function ShopAdminMerchandisePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = merchandiseList.parse(await searchParams);
  const [result, session] = await Promise.all([
    fetchAdminJson<MerchandiseProductList>(
      adminListPath("merchandise/products", {
        cursor: state.cursor,
        query: merchandiseList.apiQuery(state),
      }),
    ),
    loadAdminSession(),
  ]);
  if (result.status === "unauthorized" || session.status === "unauthorized") redirect("/login");
  if (result.status === "forbidden" || result.status === "not_found") {
    return <AdminFailedPage title="Products" status={result.status} />;
  }
  const capabilities = session.status === "ok" ? session.data.capabilities : [];

  return (
    <MerchandiseList
      state={state}
      page={
        result.status === "ok"
          ? {
              items: result.data.items.map(toMerchandiseListRow),
              nextCursor: result.data.nextCursor,
              ...(result.data.counts ? { counts: result.data.counts } : {}),
            }
          : { items: [], nextCursor: null }
      }
      canWrite={capabilities.includes("merchandise.write")}
      loadFailed={result.status === "failed"}
    />
  );
}
