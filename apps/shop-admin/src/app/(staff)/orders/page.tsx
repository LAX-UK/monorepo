import { AdminFailedPage } from "@/components/admin-fetch-state";
import { OrderList } from "@/components/orders/order-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { orderListApiQuery, parseOrderListQuery } from "@/server/domain/order-list.vm";
import type { AdminOrderList, AdminOrderSummary } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: "Orders" };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseOrderListQuery(await searchParams);
  const [result, summary] = await Promise.all([
    fetchAdminJson<AdminOrderList>(
      adminListPath("orders", { cursor: query.cursor, query: orderListApiQuery(query) }),
    ),
    fetchAdminJson<AdminOrderSummary>("orders/summary"),
  ]);
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Orders" status={result.status} />;
  }

  return (
    <OrderList
      query={query}
      page={result.data}
      // The list stands on its own; without the summary the page simply has no numbers row.
      summary={summary.status === "ok" ? summary.data : null}
      now={new Date().toISOString()}
    />
  );
}
