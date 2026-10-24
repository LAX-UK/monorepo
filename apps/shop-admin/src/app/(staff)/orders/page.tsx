import { AdminFailedPage } from "@/components/admin-fetch-state";
import { OrderList } from "@/components/orders/order-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { orderListApiQuery, parseOrderListQuery } from "@/server/domain/order-list.vm";
import type { AdminOrderList } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: "Orders" };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseOrderListQuery(await searchParams);
  const result = await fetchAdminJson<AdminOrderList>(
    adminListPath("orders", { cursor: query.cursor, query: orderListApiQuery(query) }),
  );
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Orders" status={result.status} />;
  }

  return <OrderList query={query} page={result.data} now={new Date().toISOString()} />;
}
