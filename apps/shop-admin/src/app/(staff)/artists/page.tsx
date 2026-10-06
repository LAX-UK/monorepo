import { AdminTable } from "@/components/shop-admin-shell";
import { loadAdminList } from "@/lib/admin-data.server";

export default async function ArtistsPage() {
  const data = await loadAdminList<{
    items: Array<{ slug: string; displayName: string; discipline: string | null }>;
  }>("artists?limit=50");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Artists</h1>
      <AdminTable
        columns={["Slug", "Name", "Discipline"]}
        rows={data?.items.map((row) => [row.slug, row.displayName, row.discipline ?? "—"]) ?? []}
      />
    </div>
  );
}
