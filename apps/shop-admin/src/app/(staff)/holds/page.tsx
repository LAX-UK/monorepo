import { AdminFailedPage } from "@/components/admin-fetch-state";
import { HoldsList } from "@/components/sales/holds-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import type { AdminStockHoldList } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: "Stock holds" };

export default async function HoldsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const [result, session] = await Promise.all([
    fetchAdminJson<AdminStockHoldList>(adminListPath("stock-holds", { cursor })),
    loadAdminSession(),
  ]);
  if (result.status === "unauthorized" || session.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Stock holds" status={result.status} />;
  }
  const capabilities = session.status === "ok" ? session.data.capabilities : [];

  return (
    <HoldsList
      page={result.data}
      cursor={cursor ?? null}
      canHold={capabilities.includes("stock_hold.write")}
    />
  );
}
