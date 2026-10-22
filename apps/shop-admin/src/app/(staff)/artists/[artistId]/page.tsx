import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { AdminFailedPage } from "@/components/admin-fetch-state";
import {
  ArtistSeoForm,
  LinkArtistIdentityForm,
  UnlinkArtistIdentityForm,
} from "@/components/admin-staff-action-forms.client";
import { AdminRecordTable } from "@/components/admin-staff-data-table";
import { formatAdminDetailDateTime, formatAdminDetailGbpPence } from "@/lib/admin-detail-format";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import type { AdminArtistDetail } from "@auction/shop-contracts";
import { PageHeader } from "@auction/ui";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Artist" };

export default async function ArtistDetailPage({
  params,
}: {
  params: Promise<{ artistId: string }>;
}) {
  const { artistId } = await params;
  const result = await fetchAdminJson<AdminArtistDetail>(`artists/${artistId}`);
  if (result.status === "unauthorized") redirect("/login");
  if (result.status === "not_found") notFound();
  if (result.status !== "ok") {
    return <AdminFailedPage title="Artist" status={result.status} />;
  }
  const data = result.data;

  return (
    <div className="space-y-8">
      <PageHeader
        breadcrumbs={
          <AdminBreadcrumbs
            list={{ label: "Artists", href: "/artists" }}
            current={data.artist.displayName}
          />
        }
        title={data.artist.displayName}
        description={`/${data.artist.slug}`}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <LinkArtistIdentityForm artistId={data.artist.artistId} />
        <UnlinkArtistIdentityForm artistId={data.artist.artistId} />
      </section>

      <section>
        <ArtistSeoForm
          artistId={data.artist.artistId}
          initial={{
            seoTitle: data.artist.seoTitle ?? null,
            seoDescription: data.artist.seoDescription ?? null,
          }}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Artworks</h2>
        <AdminRecordTable
          ariaLabel="Artworks"
          columns={["Title", "Slug", "Sale state"]}
          empty={{
            title: "No artworks yet",
            description: "Artworks imported for this artist will be listed here.",
          }}
          rows={data.artworks.map((row) => ({
            id: row.artworkId,
            cells: [row.title, row.slug, row.saleState],
          }))}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Editions</h2>
        <AdminRecordTable
          ariaLabel="Editions"
          columns={["Artwork", "Edition", "Status", "Owner"]}
          empty={{
            title: "No editions yet",
            description:
              "Editions of this artist's artworks, and who holds them, will be listed here.",
          }}
          rows={data.editions.map((row) => ({
            id: row.editionId,
            cells: [
              row.artworkTitle,
              String(row.editionNumber),
              row.listingStatus,
              row.ownerDisplayName,
            ],
          }))}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Sales</h2>
        <AdminRecordTable
          ariaLabel="Sales"
          columns={["Channel", "Artwork", "Edition", "Gross", "Payee", "When"]}
          empty={{
            title: "No sales yet",
            description: "Sales of this artist's work, from any channel, will be listed here.",
          }}
          rows={data.sales.map((row) => ({
            id: row.saleId,
            cells: [
              row.channel,
              row.artworkTitle,
              row.editionNumber == null ? "—" : String(row.editionNumber),
              formatAdminDetailGbpPence(row.grossPence),
              row.payeeDisplayName,
              row.occurredAt ? formatAdminDetailDateTime(row.occurredAt) : "—",
            ],
          }))}
        />
      </section>
    </div>
  );
}
