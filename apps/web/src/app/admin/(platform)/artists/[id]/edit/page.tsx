import { AdminArtistForm } from "@/components/admin/admin-artist-form";
import { AdminArtistLotsPanel } from "@/components/admin/admin-artist-lots-panel";
import { AdminArtistMergePanel } from "@/components/admin/admin-artist-merge-panel";
import { AppScreen } from "@/components/dashboard/dashboard-page";
import { getAdminArtistById, getAdminLotList } from "@/lib/data/http/admin.server";
import { Card, CardContent } from "@auction/ui/components/card";
import { PageHeader } from "@auction/ui/components/page-header";
import { notFound } from "next/navigation";

export default async function EditAdminArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [artist, lots] = await Promise.all([
    getAdminArtistById(id),
    // Best-effort fetch of the lots attached to this artist for the read-only
    // panel below. If the API is not reachable we still render the form.
    getAdminLotList({ artistId: id, limit: 25 }).catch(() => []),
  ]);
  if (!artist) notFound();

  return (
    <AppScreen className="space-y-6">
      <PageHeader
        title={`Edit ${artist.displayName}`}
        description="Manage profile copy, public visibility, and client ownership linkage."
      />
      <AdminArtistMergePanel fromArtistId={artist.id} fromDisplayName={artist.displayName} />

      <Card>
        <CardContent className="pt-6">
          <AdminArtistForm
            mode="edit"
            artistId={artist.id}
            defaultValues={{
              displayName: artist.displayName,
              slug: artist.slug,
              kind: artist.kind ?? "artist",
              status: artist.status === "merged_into" ? "approved" : (artist.status ?? "approved"),
              portraitUrl: artist.portraitUrl ?? "",
              heroImageUrl: artist.heroImageUrl ?? "",
              shortBio: artist.shortBio ?? "",
              longBio: artist.longBio ?? "",
              statement: artist.statement ?? "",
              nationality: artist.nationality ?? "",
              location: artist.location ?? "",
              birthYear: artist.birthYear ?? "",
              deathYear: artist.deathYear ?? "",
              websiteUrl: artist.websiteUrl ?? "",
              ownerUserId: artist.ownerUserId,
              featured: artist.featured,
              verified: artist.verified,
              archived: artist.archived,
            }}
          />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold tracking-tight">Lots by this artist</h2>
        <p className="text-sm text-on-surface-variant">
          Read-only summary of the lots currently attached via the catalogue FK. To reassign a lot,
          open it and use the artist picker on the lot edit page.
        </p>
        <AdminArtistLotsPanel artistId={artist.id} lots={lots} />
      </section>
    </AppScreen>
  );
}
