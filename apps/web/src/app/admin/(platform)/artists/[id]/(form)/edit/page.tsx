import { AdminArtistLotsPanel } from "@/components/admin/admin-artist-lots-panel";
import { ArtistEditForm } from "@/components/admin/artist-detail/artist-edit-form";
import { StaffActionError } from "@/components/admin/staff/staff-action-error";
import { StaffBreadcrumbs } from "@/components/admin/staff/staff-breadcrumbs";
import { loadAdminArtistEditPage } from "@/lib/admin/artists/load-artist-edit-page";
import { FormPage, Notice, StaffButtonLink } from "@auction/staff-ui";
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
  const page = await loadAdminArtistEditPage(id);
  if (page.notFound) notFound();

  const { artist, lots, categories } = page;
  const isMerged = artist.status === "merged_into";
  const detailHref = `/admin/artists/${id}`;

  return (
    <FormPage
      breadcrumbs={
        <StaffBreadcrumbs
          items={[
            { label: "Artists", href: "/admin/artists" },
            { label: artist.displayName, href: detailHref },
            { label: "Edit" },
          ]}
        />
      }
      title={`Edit ${artist.displayName}`}
      description="Update the profile's copy, status and flags, and the platform account it is linked to."
      notice={
        <>
          <StaffActionError error={sp.error} title="The artist was not saved" />
          {isMerged ? (
            <Notice
              tone="info"
              title="This profile was merged into another artist"
              actions={
                artist.mergedIntoArtistId ? (
                  <StaffButtonLink
                    size="sm"
                    variant="secondary"
                    href={`/admin/artists/${artist.mergedIntoArtistId}`}
                    Link={Link}
                  >
                    Open surviving profile
                  </StaffButtonLink>
                ) : null
              }
            >
              It is read-only. Catalogue work now happens on the surviving profile.
            </Notice>
          ) : null}
        </>
      }
    >
      <ArtistEditForm
        artist={artist}
        categories={categories}
        cancelHref={detailHref}
        readOnly={isMerged}
      />
      <AdminArtistLotsPanel
        artistId={artist.id}
        lots={lots}
        title="Lots by this artist"
        description="Change a lot's artist from the lot's own edit page."
      />
    </FormPage>
  );
}
