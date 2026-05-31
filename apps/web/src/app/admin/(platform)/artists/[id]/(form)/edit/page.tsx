import { AdminArtistForm } from "@/components/admin/admin-artist-form";
import { AdminArtistLotsPanel } from "@/components/admin/admin-artist-lots-panel";
import {
  CatalogBreadcrumbs,
  CatalogDetailActionError,
  CatalogFormShell,
} from "@/components/admin/catalog";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { getAdminArtistById, getAdminLotList } from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
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
  const [artist, lots, categories] = await Promise.all([
    getAdminArtistById(id),
    getAdminLotList({ artistId: id, limit: 25 }).catch(() => []),
    (async () => {
      try {
        return await (await getServerCategoryReader()).tree();
      } catch {
        return [];
      }
    })(),
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
      {...(isMerged
        ? {
            mobileActions: [
              {
                id: "back" as const,
                label: "Back to profile",
                variant: "secondary" as const,
                href: detailHref,
              },
            ],
          }
        : {
            wizardMobile: {
              formId: CATALOG_FORM_IDS.artist,
              submitLabel: "Save artist",
              cancelHref: detailHref,
              alwaysShowSubmit: true,
            },
          })}
    >
      <div className="space-y-8">
        <CatalogDetailActionError error={sp.error} title="Could not save artist" />
        {mergedNotice}

        <AdminArtistForm
          mode="edit"
          artistId={artist.id}
          slug={artist.slug}
          readOnly={isMerged}
          htmlFormId={CATALOG_FORM_IDS.artist}
          categories={categories}
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
            countryCode: artist.countryCode ?? "",
            birthYear: artist.birthYear ?? "",
            deathYear: artist.deathYear ?? "",
            foundedYear: artist.foundedYear ?? "",
            dissolvedYear: artist.dissolvedYear ?? "",
            websiteUrl: artist.websiteUrl ?? "",
            ownerUserId: artist.ownerUserId,
            featured: artist.featured,
            verified: artist.verified,
            archived: artist.archived,
            categoryIds: (artist.categories ?? []).map((c) => c.id),
            attributes: artist.attributes ?? {},
          }}
        />

        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold tracking-tight">Lots by this artist</h2>
          <p className="text-sm text-on-surface-variant">
            Read-only summary of the lots currently attached via the catalogue FK. To reassign a
            lot, open it and use the artist picker on the lot edit page.
          </p>
          <AdminArtistLotsPanel artistId={artist.id} lots={lots} />
        </section>
      </div>
    </CatalogFormShell>
  );
}
