import {
  LinkArtistIdentityForm,
  UnlinkArtistIdentityForm,
} from "@/components/admin-staff-action-forms.client";
import { AdminTable } from "@/components/shop-admin-shell";
import { formatAdminDetailDateTime, formatAdminDetailGbpPence } from "@/lib/admin-detail-format";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import type { AdminArtistDetail } from "@auction/shop-contracts";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ArtistDetailPage({
  params,
}: {
  params: Promise<{ artistId: string }>;
}) {
  const { artistId } = await params;
  const result = await fetchAdminJson<AdminArtistDetail>(`artists/${artistId}`);
  if (result.status === "not_found") notFound();
  if (result.status !== "ok") {
    return <p className="text-sm text-red-700">Could not load artist ({result.status}).</p>;
  }
  const data = result.data;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/artists" className="text-sm text-neutral-600 underline">
          ← Artists
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{data.artist.displayName}</h1>
        <p className="text-sm text-neutral-600">/{data.artist.slug}</p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <LinkArtistIdentityForm artistId={data.artist.artistId} />
        <UnlinkArtistIdentityForm artistId={data.artist.artistId} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Artworks</h2>
        <AdminTable
          columns={["Title", "Slug", "Sale state"]}
          rows={data.artworks.map((row) => [row.title, row.slug, row.saleState])}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Editions</h2>
        <AdminTable
          columns={["Artwork", "Edition", "Status", "Owner"]}
          rows={data.editions.map((row) => [
            row.artworkTitle,
            String(row.editionNumber),
            row.listingStatus,
            row.ownerDisplayName,
          ])}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Sales</h2>
        <AdminTable
          columns={["Channel", "Artwork", "Edition", "Gross", "Payee", "When"]}
          rows={data.sales.map((row) => [
            row.channel,
            row.artworkTitle,
            row.editionNumber == null ? "—" : String(row.editionNumber),
            formatAdminDetailGbpPence(row.grossPence),
            row.payeeDisplayName,
            row.occurredAt ? formatAdminDetailDateTime(row.occurredAt) : "—",
          ])}
        />
      </section>
    </div>
  );
}
