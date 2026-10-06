import { AdminFetchState } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { OrdersStaffListTable } from "@/components/admin-staff-list-tables.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { redirect } from "next/navigation";

type OrderList = {
  items: Array<{
    orderId: string;
    status: string;
    totalPence: number;
    createdAt: string;
  }>;
  nextCursor: string | null;
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminJson<OrderList>(adminListPath("orders", { cursor }));
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Orders</h1>
        <AdminFetchState status={result.status} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Orders</h1>
      <OrdersStaffListTable items={result.data.items} />
      <AdminListCursorNav pathname="/orders" nextCursor={result.data.nextCursor} />
    </div>
  );
}
