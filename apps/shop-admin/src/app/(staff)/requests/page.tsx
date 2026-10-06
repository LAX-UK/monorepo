import { AdminTable } from "@/components/shop-admin-shell";
import { loadAdminList } from "@/lib/admin-data.server";

export default async function RequestsPage() {
  const data = await loadAdminList<{
    items: Array<{
      requestId: string;
      artworkTitle: string;
      ownerDisplayName: string;
      requestedCount: number;
      status: string;
    }>;
  }>("sale-authority-requests?status=pending&limit=50");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Sale limit requests</h1>
      <AdminTable
        columns={["Artwork", "Owner", "Requested", "Status"]}
        rows={
          data?.items.map((row) => [
            row.artworkTitle,
            row.ownerDisplayName,
            String(row.requestedCount),
            row.status,
          ]) ?? []
        }
      />
    </div>
  );
}
