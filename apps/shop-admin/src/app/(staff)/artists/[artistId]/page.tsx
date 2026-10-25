import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { AdminFailedPage } from "@/components/admin-fetch-state";
import { AdminRecordTable } from "@/components/admin-staff-data-table";
import { ArtistHeaderActions } from "@/components/artists/artist-header-actions.client";
import { ArtistSeoForm } from "@/components/forms/people/artist-seo-form.client";
import { LinkArtistIdentityForm } from "@/components/forms/people/link-artist-identity-form.client";
import { UnlinkArtistIdentityForm } from "@/components/forms/people/unlink-artist-identity-form.client";
import { formatAdminDetailDateTime, formatAdminDetailGbpPence } from "@/lib/admin-detail-format";
import { loadArtistPage } from "@/server/application/load-artwork-pages";
import { presentArtistStatus } from "@/server/domain/artist-list.vm";
import { presentArtworkState } from "@/server/domain/artwork-list.vm";
import { EmptyState, MappedStatusBadge, PageHeader, Section } from "@auction/staff-ui";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Artist" };

export default async function ArtistDetailPage({
  params,
}: {
  params: Promise<{ artistId: string }>;
}) {
  const { artistId } = await params;
  const result = await loadArtistPage(artistId);
  if (result.status === "unauthorized") redirect("/login");
  if (result.status === "not_found") notFound();
  if (result.status !== "ok") {
    return <AdminFailedPage title="Artist" status={result.status} />;
  }
  const { detail: data, permissions } = result.data;
  const archived = data.artist.archived ?? false;
  const liveArtworkCount = data.artworks.filter(
    (row) => row.state === "live" || row.state === "sold_out",
  ).length;

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
        status={
          <MappedStatusBadge
            status={archived ? "archived" : "active"}
            present={presentArtistStatus}
          />
        }
        description={`/${data.artist.slug}`}
        primaryAction={
          permissions.write ? (
            <ArtistHeaderActions
              artistId={data.artist.artistId}
              displayName={data.artist.displayName}
              archived={archived}
              liveArtworkCount={liveArtworkCount}
            />
          ) : undefined
        }
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

      <Section
        title="Artworks"
        description={`${data.artworks.length} by this artist, drafts and archived works included`}
        bodyClassName="p-0"
        action={
          data.artworks.length > 0 ? (
            <Link
              href={`/artworks?artist=${data.artist.artistId}`}
              className="staff-focus rounded-staff-xs text-staff-sm font-medium text-staff-fg hover:underline"
            >
              Open in the artwork list
            </Link>
          ) : undefined
        }
      >
        {data.artworks.length === 0 ? (
          <EmptyState
            size="compact"
            headingLevel="h3"
            illustration="easel"
            title="No artworks yet"
            description="Add one with New artwork."
          />
        ) : (
          <ul className="divide-y divide-staff-line-subtle">
            {data.artworks.map((row) => (
              <li
                key={row.artworkId}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <Link
                  href={`/artworks/${row.artworkId}`}
                  className="staff-focus min-w-0 truncate rounded-staff-xs text-staff-sm font-medium text-staff-fg hover:underline"
                >
                  {row.title}
                </Link>
                {row.state ? (
                  <MappedStatusBadge status={row.state} present={presentArtworkState} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

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
