import { ArtistCreateForm } from "@/components/admin/artist-detail/artist-create-form";
import { StaffBreadcrumbs } from "@/components/admin/staff/staff-breadcrumbs";
import { loadAdminArtistCreatePage } from "@/lib/admin/artists/load-artist-create-page";
import { FormPage } from "@auction/staff-ui";

type Search = { ownerUserId?: string; displayName?: string; scenario?: string };

export default async function NewAdminArtistPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = await loadAdminArtistCreatePage(sp);

  return (
    <FormPage
      breadcrumbs={
        <StaffBreadcrumbs
          items={[{ label: "Artists", href: "/admin/artists" }, { label: "New artist" }]}
        />
      }
      title="New artist"
      description="Create a catalogue profile for a creator, brand or maker. Link a platform account only when the seller is also the maker."
    >
      <ArtistCreateForm
        categories={page.categories}
        ownerUserId={page.ownerUserId}
        displayName={page.displayName}
        initialScenario={page.initialScenario}
      />
    </FormPage>
  );
}
