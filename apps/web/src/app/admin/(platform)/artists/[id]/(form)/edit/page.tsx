import { AdminArtistForm } from "@/components/admin/admin-artist-form";
import { AdminArtistLotsPanel } from "@/components/admin/admin-artist-lots-panel";
import {
  CatalogBreadcrumbs,
  CatalogDetailActionError,
  CatalogFormShell,
} from "@/components/admin/catalog";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { getAdminArtistById, getAdminLotList } from "@/lib/data/http/admin.server";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EditAdminArtistPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [artist, lots] = await Promise.all([
    getAdminArtistById(id),
    getAdminLotList({ artistId: id, limit: 25 }).catch(() => []),
  ]);
  if (!artist) notFound();

  const isMerged = artist.status === "merged_into";
  const detailHref = `/admin/artists/${id}`;

  const mergedNotice = isMerged ? (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-on-surface">
      <p className="font-semibold">This profile has been merged into another artist.</p>
      <p className="mt-1 text-on-surface-variant">
        This form is read-only. All catalogue work should happen on the surviving profile.
      </p>
      {artist.mergedIntoArtistId ? (
        <Link
          href={`/admin/artists/${artist.mergedIntoArtistId}`}
          className="mt-2 inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          View merge target →
        </Link>
      ) : null}
    </div>
  ) : null;

  return (
    <CatalogFormShell
      className="md:max-w-4xl"
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[
            { label: "Artists", href: "/admin/artists" },
            { label: artist.displayName, href: detailHref },
            { label: "Edit" },
          ]}
        />
      }
      title={`Edit ${artist.displayName}`}
      description="Update catalogue copy, visibility flags, and optional platform user linkage. Profile type (catalogue-only vs maker–seller) is fixed after creation."
      mobileActions={
        isMerged
          ? [
              {
                id: "back",
                label: "Back to profile",
                variant: "secondary",
                href: detailHref,
              },
            ]
          : [
              {
                id: "save",
                label: "Save artist",
                variant: "primary",
                htmlForm: CATALOG_FORM_IDS.artist,
              },
              {
                id: "cancel",
                label: "Cancel",
                variant: "secondary",
                href: detailHref,
              },
            ]
      }
    >
      <CatalogDetailActionError error={sp.error} title="Could not save artist" />
      {mergedNotice}

      <Surface variant="card">
        <div className="pt-6">
          <AdminArtistForm
            mode="edit"
            artistId={artist.id}
            slug={artist.slug}
            readOnly={isMerged}
            htmlFormId={CATALOG_FORM_IDS.artist}
            defaultValues={{
              displayName: artist.displayName,
              kind: artist.kind ?? "artist",
              status: artist.status ?? "approved",
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
        </div>
      </Surface>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold tracking-tight">Lots by this artist</h2>
        <p className="text-sm text-on-surface-variant">
          Read-only summary of the lots currently attached via the catalogue FK. To reassign a lot,
          open it and use the artist picker on the lot edit page.
        </p>
        <AdminArtistLotsPanel artistId={artist.id} lots={lots} />
      </section>
    </CatalogFormShell>
  );
}
