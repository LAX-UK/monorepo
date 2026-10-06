import { AdminTable } from "@/components/shop-admin-shell";
import { loadAdminList } from "@/lib/admin-data.server";

export default async function PayoutsPage() {
  const data = await loadAdminList<{
    items: Array<{
      ownerDisplayName: string;
      netPence: number;
      status: string;
      payoutDueAt: string;
    }>;
  }>("payouts?limit=50");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Payouts</h1>
      <AdminTable
        columns={["Owner", "Net", "Status", "Due"]}
        rows={
          data?.items.map((row) => [
            row.ownerDisplayName,
            `£${(row.netPence / 100).toFixed(2)}`,
            row.status,
            new Date(row.payoutDueAt).toLocaleDateString("en-GB"),
          ]) ?? []
        }
      />
    </div>
  );
}
