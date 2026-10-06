import { AdminTable } from "@/components/shop-admin-shell";
import { loadAdminList } from "@/lib/admin-data.server";

export default async function HoldsPage() {
  const data = await loadAdminList<{
    items: Array<{
      artworkTitle: string;
      editionNumber: number;
      status: string;
      expiresAt: string;
    }>;
  }>("stock-holds?limit=50");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Stock holds</h1>
      <AdminTable
        columns={["Artwork", "Edition", "Status", "Expires"]}
        rows={
          data?.items.map((row) => [
            row.artworkTitle,
            String(row.editionNumber),
            row.status,
            new Date(row.expiresAt).toLocaleDateString("en-GB"),
          ]) ?? []
        }
      />
    </div>
  );
}
