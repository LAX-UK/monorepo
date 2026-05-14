import { AdminArtistForm } from "@/components/admin/admin-artist-form";
import { AdminArtistLotsPanel } from "@/components/admin/admin-artist-lots-panel";
import { AdminEntityFormShell } from "@/components/admin/admin-entity-form-shell";
import { getAdminArtistById, getAdminLotList } from "@/lib/data/http/admin.server";
import { Card, CardContent } from "@auction/ui/components/card";
import Link from "next/link";
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

  const mergedNotice =
    artist.status === "merged_into" && artist.mergedIntoArtistId ? (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-on-surface">
        This profile is marked <strong>merged</strong>. Canonical work should happen on the{" "}
        <Link
          href={`/admin/artists/${artist.mergedIntoArtistId}`}
          className="font-medium text-primary hover:underline"
        >
          surviving artist
        </Link>
        . The form below may be locked down by policy; prefer the surviving profile for edits.
      </div>
    ) : null;

  return (
    <AdminEntityFormShell
      maxWidthClassName="max-w-4xl"
      breadcrumbs={
        <Link
          href="/admin/artists"
          className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
        >
          ← Artists
        </Link>
      }
      title={`Edit ${artist.displayName}`}
      description="Update catalogue copy, visibility flags, and optional platform user linkage. Profile type (catalogue-only vs maker–seller) is fixed after creation."
    >
      {mergedNotice}

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
    </AdminEntityFormShell>
  );
}
