import { AdminTable } from "@/components/shop-admin-shell";
import { loadAdminList } from "@/lib/admin-data.server";

export default async function ClientsPage() {
  const data = await loadAdminList<{
    items: Array<{ partyId: string; displayName: string; kind: string }>;
  }>("clients?limit=50");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Clients</h1>
      <AdminTable
        columns={["Party", "Name", "Kind"]}
        rows={data?.items.map((row) => [row.partyId.slice(0, 8), row.displayName, row.kind]) ?? []}
      />
    </div>
  );
}
