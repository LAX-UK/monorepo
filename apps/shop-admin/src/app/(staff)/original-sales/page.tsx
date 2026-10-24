import { AdminFailedPage } from "@/components/admin-fetch-state";
import { OriginalSalesList } from "@/components/sales/original-sales-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import type { AdminOriginalSaleList } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: "Original sales" };

export default async function ShopAdminOriginalSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const [result, session] = await Promise.all([
    fetchAdminJson<AdminOriginalSaleList>(adminListPath("original-sales", { cursor })),
    loadAdminSession(),
  ]);
  if (result.status === "unauthorized" || session.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Original sales" status={result.status} />;
  }
  const capabilities = session.status === "ok" ? session.data.capabilities : [];

  return (
    <OriginalSalesList
      page={result.data}
      cursor={cursor ?? null}
      canSell={capabilities.includes("original_sale.write")}
    />
  );
}
