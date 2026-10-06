import { AdminTable } from "@/components/shop-admin-shell";
import { loadAdminList } from "@/lib/admin-data.server";

export default async function OrdersPage() {
  const data = await loadAdminList<{
    items: Array<{
      orderId: string;
      status: string;
      totalPence: number;
      createdAt: string;
    }>;
  }>("orders?limit=50");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Orders</h1>
      <AdminTable
        columns={["Order", "Status", "Total", "Created"]}
        rows={
          data?.items.map((row) => [
            row.orderId.slice(0, 8),
            row.status,
            `£${(row.totalPence / 100).toFixed(2)}`,
            new Date(row.createdAt).toLocaleDateString("en-GB"),
          ]) ?? []
        }
      />
    </div>
  );
}
