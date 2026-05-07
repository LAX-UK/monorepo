import { AdminArtistForm } from "@/components/admin/admin-artist-form";
import { AdminArtistMergePanel } from "@/components/admin/admin-artist-merge-panel";
import { getAdminArtistById, getAdminUserList } from "@/lib/data/http/admin.server";
import { Card, CardContent } from "@auction/ui/components/card";
import { PageHeader } from "@auction/ui/components/page-header";
import { notFound } from "next/navigation";

export default async function EditAdminArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [artist, users] = await Promise.all([
    getAdminArtistById(id),
    getAdminUserList({ limit: 100 }),
  ]);
  if (!artist) notFound();

  return (
    <div className="screen w-full space-y-6">
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
            users={users.rows}
            defaultValues={{
              displayName: artist.displayName,
              slug: artist.slug,
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
    </div>
  );
}
