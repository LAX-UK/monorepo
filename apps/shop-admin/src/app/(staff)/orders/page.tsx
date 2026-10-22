import { AdminFailedPage } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { OrdersStaffListTable } from "@/components/admin-staff-list-tables.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { PageHeader } from "@auction/ui";
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

export const metadata = { title: "Orders" };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminJson<OrderList>(adminListPath("orders", { cursor }));
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Orders" status={result.status} />;
  }

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Shop orders, newest first. Open an order to cancel a line or issue a refund."
      />
      <OrdersStaffListTable items={result.data.items} />
      <AdminListCursorNav cursor={cursor} pathname="/orders" nextCursor={result.data.nextCursor} />
    </div>
  );
}
